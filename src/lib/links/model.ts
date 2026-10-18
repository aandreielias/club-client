// Mirrors of the club-server link DTOs (platform.Links, InventoryApi.Need, FilesApi.FileRef).

/** Part of an item's stock (server: InventoryApi.StockDto): a place, a person or "ohne Ort". */
export interface StockPlace {
  kind: 'LOCATION' | 'PERSON' | 'NONE';
  /** Location or member id; null for NONE. */
  id: string | null;
  /** null for NONE and for people who are no longer active. */
  name: string | null;
  quantity: number;
}

/** "Halle 1", "Clara Trainer", "Ohne Ort" - how a stock line is named. */
export function placeName(place: StockPlace): string {
  if (place.kind === 'NONE') return 'Ohne Ort';
  return place.name ?? (place.kind === 'PERSON' ? 'Ehemaliges Mitglied' : 'Gelöschter Ort');
}

/**
 * One "Benötigt" entry. A deleted item keeps its last name, has no stock and is marked deleted.
 * `places`: where the items are (privileged viewers: all; others: only what they hold themselves).
 */
export interface Need {
  itemId: string;
  name: string;
  quantity: number;
  stock: number | null;
  deleted: boolean;
  places: StockPlace[];
}

/** An attached file. A deleted file keeps its last name and has no content type. */
export interface FileRef {
  id: string;
  folderId: string;
  name: string;
  contentType: string | null;
  sizeBytes: number;
  deleted: boolean;
}

/** "Benötigt" list and attachments of an appointment or a task, as the signed-in member may see them. */
export interface Links {
  needs: Need[];
  files: FileRef[];
}

export interface NeedInput {
  itemId: string;
  quantity: number;
}

/** What the pickers offer: inventory items and visible documents. */
export interface LinkOption {
  id: string;
  label: string;
}

export interface ItemOption extends LinkOption {
  name: string;
  stock: number;
}

export interface FileOption extends LinkOption {
  file: FileRef;
}
