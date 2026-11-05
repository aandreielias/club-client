import type { CalendarApi } from './CalendarApi';
import type { Holiday } from './model';

/** The club's holidays (server: calendar_holiday), for the Feiertage list and its windows. */
export class HolidaysStore {
  items: readonly Holiday[] = $state.raw([]);

  constructor(private readonly api: CalendarApi) {}

  async load(): Promise<readonly Holiday[]> {
    this.items = await this.api.holidays();
    return this.items;
  }

  get(id: string): Holiday | undefined {
    return this.items.find((h) => h.id === id);
  }
}
