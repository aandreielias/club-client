// The time scale of the TimelineBar: hours before or after a meeting on a logarithmic axis, so 1 hour and 8 weeks both fit.

/** Farthest point drawn on each side (longer offsets sit at the edge; the number field still takes them). */
export const MAX_HOURS = 60 * 24;
const LOG_MAX = Math.log1p(MAX_HOURS);

/** 0 (at the meeting) … 1 (the far edge) for an offset in hours. */
export function toFraction(hours: number): number {
  return Math.min(1, Math.log1p(Math.max(0, hours)) / LOG_MAX);
}

/** The offset for a fraction of one side, snapped: whole hours under two days, whole days above. */
export function toHours(fraction: number): number {
  return snap(Math.expm1(Math.min(1, Math.max(0, fraction)) * LOG_MAX));
}

export function snap(hours: number): number {
  return hours < 48 ? Math.round(hours) : Math.round(hours / 24) * 24;
}

/** One arrow-key step from `hours`: an hour under two days, a day above (a week with Shift). */
export function nudge(hours: number, direction: 1 | -1, big = false): number {
  const inHours = direction > 0 ? hours < 48 : hours <= 48;
  const step = big ? 7 * 24 : inHours ? 1 : 24;
  return Math.max(0, Math.min(8760, snap(hours + direction * step)));
}

/** "3 Std.", "2 Tage", "1 Woche" — the short label on a marker. */
export function shortLabel(hours: number): string {
  if (hours < 48) return `${hours} Std.`;
  const days = Math.round(hours / 24);
  if (days % 7 === 0) return `${days / 7} ${days === 7 ? 'Woche' : 'Wochen'}`;
  return `${days} Tage`;
}
