// Shared date math for lifecycle/reminder crons.
//
// Trip.startDate / Trip.endDate are `timestamp without time zone` (no per-trip timezone is
// stored), which Prisma reads as UTC. Comparing them as raw instants against the cron run time
// makes an email's firing depend on the stored time-of-day and the cron's run hour, which is how
// "Tomorrow's the day" went out two days early. Flooring BOTH operands to UTC midnight and taking
// the integer day difference removes that: the result is an exact calendar-day count that cannot
// shift with the run time or the stored time-of-day. Positive when `to` is after `from`.
export function utcCalendarDaysBetween(from: Date, to: Date): number {
  const fromMidnight = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const toMidnight = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((toMidnight - fromMidnight) / 86_400_000);
}
