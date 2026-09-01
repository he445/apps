/**
 * Utilitários de fuso horário.
 *
 * O produto é inteiramente brasileiro (Carnê-Leão, CPF, CRP, PIX), mas o servidor
 * roda em UTC. Sem esta camada, duas coisas quebravam:
 *
 *  - Uma consulta marcada às 14h era gravada às 14h UTC, ou seja, 11h em São Paulo.
 *  - A janela do "dia de hoje" da autoavaliação começava às 21h do dia anterior,
 *    então o paciente que respondesse depois das 21h recebia o formulário em branco.
 */

/** Fuso de referência do produto. Configurável para quando houver atendimento fora do Brasil. */
export const APP_TIMEZONE = process.env.APP_TIMEZONE?.trim() || 'America/Sao_Paulo';

/** Aceita apenas ISO 8601 com fuso explícito: sufixo Z ou deslocamento ±HH:MM. */
const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

export function isIsoWithOffset(value: unknown): boolean {
  return typeof value === 'string' && ISO_WITH_OFFSET.test(value) && !Number.isNaN(Date.parse(value));
}

/** Deslocamento do fuso do produto, em minutos, para um instante específico (trata horário de verão). */
function offsetMinutes(instant: Date, timeZone: string): number {
  // "en-US" com timeZoneName: "longOffset" devolve algo como "GMT-03:00".
  const formatted = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
    .formatToParts(instant)
    .find((part) => part.type === 'timeZoneName')?.value;
  const match = formatted?.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) return 0;
  const [, sign, hours, minutes] = match;
  const total = Number(hours) * 60 + Number(minutes);
  return sign === '-' ? -total : total;
}

/**
 * Início e fim do dia corrente no fuso do produto, expressos em instantes UTC
 * para comparação direta com colunas `timestamp` do banco.
 */
export function dayRangeInAppTimezone(reference: Date = new Date(), timeZone: string = APP_TIMEZONE) {
  const offset = offsetMinutes(reference, timeZone);
  // Desloca para o "relógio local", extrai a data e volta o deslocamento.
  const local = new Date(reference.getTime() + offset * 60_000);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const d = local.getUTCDate();

  const start = new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - offset * 60_000);
  const end = new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - offset * 60_000);
  return { start, end };
}
