/** A club year starting in a given month: the season or the fiscal year (server: platform.ClubYear). */

/** The year `today` falls in, named by its first calendar year. */
export function yearOf(today: string, startMonth: number): number {
  const [year, month] = today.split('-').map(Number);
  return month >= startMonth ? year : year - 1;
}

/** 2026 → '2026/27'; with start month 1 the year is the calendar year ('2026'). */
export const yearLabel = (year: number, startMonth: number): string =>
  startMonth === 1 ? String(year) : `${year}/${String((year + 1) % 100).padStart(2, '0')}`;
