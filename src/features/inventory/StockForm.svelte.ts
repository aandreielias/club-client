import { settings } from '../../settings';
import type { StockInput, StockPlace } from './model';

/** One editable stock line; `place` is 'none', 'location:<id>' or 'person:<id>' (one select for both kinds). */
export interface StockLine {
  key: number;
  place: string;
  quantity: number;
}

const limits = settings.inventory;

/** Editing where an item is: lines of place or person plus count; the total becomes the item's quantity. */
export class StockForm {
  lines = $state<StockLine[]>([]);
  submitted = $state(false);
  #next = 0;

  readonly total: number;
  readonly error: string | null;

  constructor(stock: readonly StockPlace[]) {
    this.lines = stock.map((s) => this.line(StockForm.placeKey(s), s.quantity));
    if (!this.lines.length) this.add();
    this.total = $derived(this.lines.reduce((sum, l) => sum + (Number.isFinite(l.quantity) ? l.quantity : 0), 0));
    this.error = $derived(this.validate());
  }

  static placeKey(place: Pick<StockPlace, 'kind' | 'id'>): string {
    return place.kind === 'NONE' || !place.id ? 'none' : `${place.kind === 'LOCATION' ? 'location' : 'person'}:${place.id}`;
  }

  add(place = 'none', quantity = 1): void {
    this.lines = [...this.lines, this.line(place, quantity)];
  }

  remove(key: number): void {
    this.lines = this.lines.filter((l) => l.key !== key);
  }

  /** Same place twice is summed up, like the server does. */
  toInput(): StockInput[] {
    const merged = new Map<string, number>();
    for (const l of this.lines) merged.set(l.place, (merged.get(l.place) ?? 0) + l.quantity);
    return [...merged].map(([place, quantity]) => {
      const [kind, id] = place.split(':');
      return { locationId: kind === 'location' ? id : null, holderId: kind === 'person' ? id : null, quantity };
    });
  }

  private line(place: string, quantity: number): StockLine {
    return { key: this.#next++, place, quantity };
  }

  private validate(): string | null {
    if (this.lines.some((l) => !Number.isInteger(l.quantity) || l.quantity < 1)) return 'Jede Zeile braucht eine Anzahl ab 1.';
    if (this.total > limits.maxQuantity) return `Insgesamt höchstens ${limits.maxQuantity}.`;
    if (this.lines.length > limits.maxStockLines) return `Höchstens ${limits.maxStockLines} Zeilen.`;
    return null;
  }
}
