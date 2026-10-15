// Mirrors of the club-server inventory DTOs (InventoryApi).

export interface Item {
  id: string;
  name: string;
  category: string | null;
  quantity: number;
  location: string | null;
  description: string | null;
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

export interface NewItem {
  name: string;
  category: string | null;
  quantity: number;
  location: string | null;
  description: string | null;
}

/** Null fields stay unchanged; an empty text clears it. */
export type ItemPatch = Partial<{ [K in keyof NewItem]: NewItem[K] }>;
