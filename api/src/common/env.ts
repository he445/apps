/**
 * Validação centralizada das variáveis de ambiente.
 *
 * Antes desta camada nenhum ponto da API carregava o `.env`: `process.env.JWT_SECRET`
 * ficava indefinido em desenvolvimento e o token era assinado com um segredo fixo
 * presente no código-fonte. A validação roda no arranque, uma única vez, e derruba
 * o processo se algo obrigatório estiver ausente ou fraco.
 */

export type AppEnv = {
  nodeEnv: 'development' | 'test' | 'production';
  isProd: boolean;
  port: number;
  jwtSecret: string;
  webOrigins: string[];
  sandboxEnabled: boolean;
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

  const webOrigins = (source.WEB_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
  if (isProd && webOrigins.length === 0) {
    errors.push('WEB_ORIGIN é obrigatória em produção e define as origens autorizadas do CORS.');
  }

  const port = Number(source.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.push(`PORT inválida: "${source.PORT}".`);
  }

  const sandboxEnabled = source.ENABLE_SANDBOX_ADMIN === 'true';

  if (errors.length > 0) {
    throw new Error(
      `Configuração de ambiente inválida:\n${errors.map((error) => `  - ${error}`).join('\n')}\n` +
        'Consulte api/.env.example para o conjunto completo de variáveis.',
    );
  }

  return { nodeEnv, isProd, port, jwtSecret, webOrigins, sandboxEnabled };
}
