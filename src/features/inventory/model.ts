// Mirrors of the club-server inventory DTOs (InventoryApi).

import { placeName, type StockPlace } from '../../lib/links/model';

export { placeName, type StockPlace };

export interface Item {
  id: string;
  name: string;
  category: string | null;
  /** The sum of the stock. */
  quantity: number;
  description: string | null;
  /** Where the items are, in the order they were entered. */
  stock: StockPlace[];
  createdAt: string;
  updatedAt: string;
}

export interface ItemList {
  items: Item[];
}

/** An upcoming appointment or open task that needs the item; `at` is its start or due date. */
export interface ItemUse {
  kind: 'APPOINTMENT' | 'TASK';
  id: string;
  title: string;
  at: string | null;
  quantity: number;
}

/** The whole quantity starts at `locationId` (a place) or "ohne Ort". */
export interface NewItem {
  name: string;
  category: string | null;
  quantity: number;
  locationId: string | null;
  description: string | null;
}

/** Null fields stay unchanged; an empty text clears it. The quantity follows the stock. */
export type ItemPatch = Partial<Pick<NewItem, 'name' | 'category' | 'description'>>;

/** One line of the stock editor: at most one of locationId and holderId; neither = "ohne Ort". */
export interface StockInput {
  locationId: string | null;
  holderId: string | null;
  quantity: number;
}

/** What the signed-in member holds (GET /inventory/mine). */
export interface OwnItem {
  itemId: string;
  name: string;
  quantity: number;
}

/** List summary: the first two places, then "+n". */
export function stockSummary(stock: readonly StockPlace[]): string | null {
  if (!stock.length) return null;
  const names = stock.slice(0, 2).map(placeName);
  return stock.length > 2 ? `${names.join(', ')} +${stock.length - 2}` : names.join(', ');
}
