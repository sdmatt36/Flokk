/**
 * Dates are stored in Postgres as midnight local time (JST = T15:00:00.000Z).
 * On Vercel (UTC), new Date("2025-05-03T15:00:00.000Z") gives May 3 — off by one.
 * Adding 12h before extracting UTC fields gives the correct calendar day
 * for any timezone within UTC±12h.
 */
export function parseDateForDisplay(iso: string): Date {
  const d = new Date(iso);
  const shifted = new Date(d.getTime() + 12 * 60 * 60 * 1000);
  return new Date(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
}
