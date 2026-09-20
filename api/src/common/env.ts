/**
 * Centralised environment variable validation.
 *
 * Antes desta camada nenhum ponto da API carregava o `.env`: `process.env.JWT_SECRET`
 * ficava indefinido em desenvolvimento e o token era assinado com um segredo fixo
 * hardcoded in the source. Validation runs once at boot and kills the process if
 * anything required is missing or weak.
 */

import { buildKeyring } from './encryption.service';

export type AppEnv = {
  nodeEnv: 'development' | 'test' | 'production';
  isProd: boolean;
  port: number;
  jwtSecret: string;
  /** Canonical web origin. Also used to build links (invitations, e-mails). */
  webOrigin: string;
  /** Origins allowed by CORS: the canonical one plus any preview deployments. */
  corsOrigins: string[];
  /** Key version used when writing encrypted clinical content. */
  encryptionKeyVersion: number;
};

const MIN_JWT_SECRET_LENGTH = 32;

/**
 * Secrets that have appeared in the repository or documentation and must never sign
 * a token again, even if someone sets them on purpose.
 */
const FORBIDDEN_SECRETS = new Set([
  'development-only-secret',
  'replace-with-a-random-secret-of-at-least-32-characters',
]);

export function validateEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const errors: string[] = [];

  const rawNodeEnv = source.NODE_ENV?.trim() || 'development';
  if (!['development', 'test', 'production'].includes(rawNodeEnv)) {
    errors.push(`NODE_ENV deve ser development, test ou production (recebido: "${rawNodeEnv}").`);
  }
  const nodeEnv = rawNodeEnv as AppEnv['nodeEnv'];
  const isProd = nodeEnv === 'production';

  if (!source.DATABASE_URL?.trim()) {
    errors.push('DATABASE_URL é obrigatória.');
  }

  const jwtSecret = source.JWT_SECRET?.trim() ?? '';
  if (!jwtSecret) {
    errors.push('JWT_SECRET é obrigatória em todos os ambientes.');
  } else if (FORBIDDEN_SECRETS.has(jwtSecret)) {
    errors.push('JWT_SECRET está usando um valor de exemplo público. Gere uma chave aleatória própria.');
  } else if (jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
    errors.push(`JWT_SECRET precisa de ao menos ${MIN_JWT_SECRET_LENGTH} caracteres (recebido: ${jwtSecret.length}).`);
  }

  // WEB_ORIGIN is the canonical origin and must hold a SINGLE URL: it also builds the
  // invitation link, and a comma-separated list would produce a broken one. Extra
  // origins (previews) belong in CORS_ORIGINS, which only affects CORS.
  const webOrigin = (source.WEB_ORIGIN ?? '').trim().replace(/\/$/, '');
  if (isProd && !webOrigin) {
    errors.push('WEB_ORIGIN é obrigatória em produção (URL canônica do frontend).');
  }
  if (webOrigin.includes(',')) {
    errors.push('WEB_ORIGIN aceita uma única URL. Use CORS_ORIGINS para autorizar origens adicionais.');
  }

  const extraCorsOrigins = (source.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
  const corsOrigins = Array.from(new Set([webOrigin, ...extraCorsOrigins].filter(Boolean)));

  const port = Number(source.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.push(`PORT inválida: "${source.PORT}".`);
  }

  // Clinical content is encrypted at the application level. Without a valid key the
  // API would write sensitive data in plaintext, so failing at boot beats degrading
  // silently. buildKeyring checks length, format and known example values.
  let encryptionKeyVersion = 1;
  try {
    encryptionKeyVersion = buildKeyring(source).activeVersion;
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  if (errors.length > 0) {
    throw new Error(
      `Configuração de ambiente inválida:\n${errors.map((error) => `  - ${error}`).join('\n')}\n` +
        'Consulte api/.env.example para o conjunto completo de variáveis.',
    );
  }

  return { nodeEnv, isProd, port, jwtSecret, webOrigin, corsOrigins, encryptionKeyVersion };
}
