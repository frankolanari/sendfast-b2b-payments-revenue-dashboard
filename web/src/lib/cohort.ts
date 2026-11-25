import { month } from "./format";

const iso = (y: number, m: number) =>
  new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);

/**
 * The calendar months a cohort's "month N" covers: accounts went live across a quarter, so
 * month N after go-live falls anywhere from the quarter's first month + N to its last + N.
 */
export function calendarWindow(
  quarter: string,
  monthsSinceLive: number,
): string {
  const m = /^(\d{4})Q([1-4])$/.exec(quarter);
  if (!m) return "";
  const year = Number(m[1]);
  const first = (Number(m[2]) - 1) * 3 + monthsSinceLive;
  const from = iso(year, first);
  const to = iso(year, first + 2);
  return `${month(from)} – ${month(to)}`;
}
