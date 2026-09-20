/**
 * Timezone helpers.
 *
 * The product is entirely Brazilian (Carnê-Leão, CPF, CRP, PIX) but the server
 * roda em UTC. Sem esta camada, duas coisas quebravam:
 *
 *  - A consultation booked for 14:00 was stored as 14:00 UTC, i.e. 11:00 in São Paulo.
 *  - The self-assessment "today" window started at 21:00 the previous day, so a
 *    patient answering after 21:00 was handed a blank form.
 */

/** The product's reference timezone. Configurable for practices outside Brazil. */
export const APP_TIMEZONE = process.env.APP_TIMEZONE?.trim() || 'America/Sao_Paulo';

/** Accepts only ISO 8601 with an explicit zone: a Z suffix or a ±HH:MM offset. */
const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

export function isIsoWithOffset(value: unknown): boolean {
  return typeof value === 'string' && ISO_WITH_OFFSET.test(value) && !Number.isNaN(Date.parse(value));
}

/** The product timezone's offset in minutes at a given instant (handles DST). */
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
 * Start and end of the current day in the product's timezone, as UTC instants so
 * they compare directly against the database's `timestamp` columns.
 */
export function dayRangeInAppTimezone(reference: Date = new Date(), timeZone: string = APP_TIMEZONE) {
  const offset = offsetMinutes(reference, timeZone);
  // Shift into "local clock" time, take the calendar date, then shift back.
  const local = new Date(reference.getTime() + offset * 60_000);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const d = local.getUTCDate();

  const start = new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - offset * 60_000);
  const end = new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - offset * 60_000);
  return { start, end };
}
