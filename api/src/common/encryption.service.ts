import { Global, Injectable, Module } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Application-level encryption for clinical fields.
 *
 * Therapeutic content — chat conversations, the emotional diary and guidelines — is
 * sensitive personal data (LGPD art. 5, II). Without this layer, anyone with read
 * access to the database, to a backup or to a leaked connection string reads the whole
 * record in plaintext.
 *
 * AES-256-GCM, chosen because it is an authenticated mode: besides protecting the
 * content it detects tampering with the ciphertext (decrypt throws instead of
 * returning garbage). Uses only Node's built-in `crypto` — no new dependency.
 *
 * Stored format: base64(iv ‖ authTag ‖ ciphertext), with the key version in a separate
 * column. Measured cost: ~20 µs to encrypt and ~10 µs to decrypt a 500-character
 * message.
 *
 * Messages thrown here stay in Portuguese: they are read by the operator in the
 * deploy logs.
 */

const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const KEY_BYTES = 32;

/** Keys that have circulated publicly and must never encrypt real data. */
const FORBIDDEN_KEYS = new Set([
  'replace-with-a-32-byte-base64-key',
  Buffer.alloc(KEY_BYTES).toString('base64'), // 32 zeroed bytes
]);

export type EncryptionKeyring = {
  /** Version used for writing. Always the newest one. */
  activeVersion: number;
  /** Every known key by version — retired ones included, so old rows stay readable. */
  keys: Map<number, Buffer>;
};

function parseKey(raw: string, label: string): Buffer {
  const trimmed = raw.trim();
  if (FORBIDDEN_KEYS.has(trimmed)) {
    throw new Error(`${label} está usando um valor de exemplo público. Gere uma chave própria.`);
  }
  const key = Buffer.from(trimmed, 'base64');
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `${label} deve ser exatamente ${KEY_BYTES} bytes em base64 (recebido: ${key.length}). ` +
        `Gere com: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
    );
  }
  return key;
}

/**
 * Builds the keyring from the environment.
 *
 * APP_ENCRYPTION_KEY          active key (required)
 * APP_ENCRYPTION_KEY_VERSION  version of the active key (optional, defaults to 1)
 * APP_ENCRYPTION_KEYS_RETIRED older read-only keys, "version:base64,version:base64"
 *
 * Rotation is therefore a configuration change: bump the version, move the previous
 * key to RETIRED, and existing rows stay readable until they are re-encrypted.
 */
export function buildKeyring(source: NodeJS.ProcessEnv = process.env): EncryptionKeyring {
  const active = source.APP_ENCRYPTION_KEY?.trim();
  if (!active) {
    throw new Error(
      'APP_ENCRYPTION_KEY é obrigatória: sem ela a API gravaria conteúdo clínico em texto claro.',
    );
  }

  const activeVersion = Number(source.APP_ENCRYPTION_KEY_VERSION ?? 1);
  if (!Number.isInteger(activeVersion) || activeVersion < 1) {
    throw new Error(`APP_ENCRYPTION_KEY_VERSION deve ser um inteiro >= 1 (recebido: "${source.APP_ENCRYPTION_KEY_VERSION}").`);
  }

  const keys = new Map<number, Buffer>();
  keys.set(activeVersion, parseKey(active, 'APP_ENCRYPTION_KEY'));

  for (const entry of (source.APP_ENCRYPTION_KEYS_RETIRED ?? '').split(',')) {
    const pair = entry.trim();
    if (!pair) continue;
    const separator = pair.indexOf(':');
    const version = Number(pair.slice(0, separator));
    if (separator < 1 || !Number.isInteger(version) || version < 1) {
      throw new Error('APP_ENCRYPTION_KEYS_RETIRED deve seguir o formato "versao:chaveBase64,versao:chaveBase64".');
    }
    if (keys.has(version)) {
      throw new Error(`APP_ENCRYPTION_KEYS_RETIRED repete a versão ${version}, que já é a chave ativa.`);
    }
    keys.set(version, parseKey(pair.slice(separator + 1), `APP_ENCRYPTION_KEYS_RETIRED (versão ${version})`));
  }

  return { activeVersion, keys };
}

@Injectable()
export class EncryptionService {
  private readonly keyring: EncryptionKeyring;

  constructor() {
    this.keyring = buildKeyring();
  }

  get activeVersion(): number {
    return this.keyring.activeVersion;
  }

  /** Encrypts with the active key. Returns base64(iv ‖ authTag ‖ ciphertext). */
  encrypt(plaintext: string): string {
    const key = this.keyring.keys.get(this.keyring.activeVersion)!;
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
  }

  /** Decrypts. Throws if the content was tampered with or the key version is unknown. */
  decrypt(stored: string, keyVersion: number): string {
    const key = this.keyring.keys.get(keyVersion);
    if (!key) {
      throw new Error(
        `Chave de criptografia versão ${keyVersion} não está disponível. ` +
          'Defina-a em APP_ENCRYPTION_KEYS_RETIRED para manter os registros antigos legíveis.',
      );
    }
    const raw = Buffer.from(stored, 'base64');
    // Strictly less than: encrypting an empty string yields exactly IV + authTag, and
    // that is a legitimate value (an optional field saved blank).
    if (raw.length < IV_BYTES + AUTH_TAG_BYTES) {
      throw new Error('Conteúdo cifrado malformado: menor que o cabeçalho mínimo.');
    }
    const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, IV_BYTES));
    decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES));
    return Buffer.concat([
      decipher.update(raw.subarray(IV_BYTES + AUTH_TAG_BYTES)),
      decipher.final(),
    ]).toString('utf8');
  }

  /**
   * Transition-tolerant read.
   *
   * Until the backfill finishes, encrypted rows (keyVersion set) and still-plaintext
   * rows (keyVersion null) coexist. This resolves both so no caller has to know the
   * difference.
   */
  read(encrypted: string | null | undefined, keyVersion: number | null | undefined, plaintext: string | null | undefined): string {
    if (encrypted != null && keyVersion != null) {
      return this.decrypt(encrypted, keyVersion);
    }
    return plaintext ?? '';
  }

  /** Same as `read`, but keeps `null` for optional fields such as the diary note. */
  readOptional(encrypted: string | null | undefined, keyVersion: number | null | undefined, plaintext: string | null | undefined): string | null {
    if (encrypted != null && keyVersion != null) {
      return this.decrypt(encrypted, keyVersion);
    }
    return plaintext ?? null;
  }
}

@Global()
@Module({ providers: [EncryptionService], exports: [EncryptionService] })
export class EncryptionModule {}
