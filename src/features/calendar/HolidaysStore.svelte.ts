import type { CalendarApi } from './CalendarApi';
import type { Holiday } from './model';

/** The club's holidays (server: calendar_holiday), for the Feiertage list and its windows. */
export class HolidaysStore {
  items: readonly Holiday[] = $state.raw([]);

  constructor(private readonly api: CalendarApi) {}

  #sequence = 0;

  /** Only the newest load sets the list: an older answer arriving late never overwrites a newer one. */
  async load(): Promise<readonly Holiday[]> {
    const sequence = ++this.#sequence;
    const items = await this.api.holidays();
    if (sequence === this.#sequence) this.items = items;
    return items;
  }

  get(id: string): Holiday | undefined {
    return this.items.find((h) => h.id === id);
  }
}
