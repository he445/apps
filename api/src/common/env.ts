/**
 * Validação centralizada das variáveis de ambiente.
 *
 * Antes desta camada nenhum ponto da API carregava o `.env`: `process.env.JWT_SECRET`
 * ficava indefinido em desenvolvimento e o token era assinado com um segredo fixo
 * presente no código-fonte. A validação roda no arranque, uma única vez, e derruba
 * o processo se algo obrigatório estiver ausente ou fraco.
 */

import { buildKeyring } from './encryption.service';

export type AppEnv = {
  nodeEnv: 'development' | 'test' | 'production';
  isProd: boolean;
  port: number;
  jwtSecret: string;
  /** Origem canônica do frontend. Usada para montar links (convite, e-mails). */
  webOrigin: string;
  /** Origens autorizadas no CORS. Inclui a canônica mais quaisquer previews. */
  corsOrigins: string[];
  sandboxEnabled: boolean;
  /** Versão da chave usada para gravar conteúdo clínico cifrado. */
  encryptionKeyVersion: number;
};

const MIN_JWT_SECRET_LENGTH = 32;

/**
 * Segredos que já circularam em repositório ou documentação e nunca podem
 * voltar a assinar um token, mesmo que alguém os defina explicitamente.
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

  // WEB_ORIGIN é a origem canônica e deve conter UMA única URL: ela também monta o
  // link de convite, e uma lista separada por vírgula produziria um link quebrado.
  // Origens extras (previews) vão em CORS_ORIGINS, que só afeta o CORS.
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

  const sandboxEnabled = source.ENABLE_SANDBOX_ADMIN === 'true';

  // Conteúdo clínico é cifrado em nível de aplicação. Sem chave válida a API
  // gravaria dado sensível em texto claro — falhar no arranque é preferível a
  // degradar em silêncio. buildKeyring valida tamanho, formato e valores de exemplo.
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

  return { nodeEnv, isProd, port, jwtSecret, webOrigin, corsOrigins, sandboxEnabled, encryptionKeyVersion };
}
