import type { LocalDateTime } from './ZonedClock';

/** A rhythm (server: platform.Repeat): every `weeks` weeks, or every `months` months on the same date or the same nth weekday. */
export interface Rhythm {
  weeks: number;
  months: number;
  byWeekday: boolean;
}

const ymd = (y: number, m: number, d: number): string => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);

/** The i-th date from a club-local anchor, keeping the local time. Day 31 falls to the month's last day; a 5th weekday to the last. */
export function repeatAt(anchor: LocalDateTime, r: Rhythm, i: number): LocalDateTime {
  const [date, time] = anchor.split('T');
  const [y, m, d] = date.split('-').map(Number);
  if (r.weeks > 0) return `${ymd(y, m - 1, d + 7 * r.weeks * i)}T${time}`;
  const total = m - 1 + r.months * i;
  const ty = y + Math.floor(total / 12);
  const tm = total % 12;
  const last = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  if (!r.byWeekday) return `${ymd(ty, tm, Math.min(d, last))}T${time}`;
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const first = 1 + ((weekday - new Date(Date.UTC(ty, tm, 1)).getUTCDay() + 7) % 7);
  const ordinal = Math.floor((d - 1) / 7) + 1;
  return `${ymd(ty, tm, ordinal === 5 ? first + 7 * Math.floor((last - first) / 7) : first + 7 * (ordinal - 1))}T${time}`;
}
