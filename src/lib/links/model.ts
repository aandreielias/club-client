// Mirrors of the club-server link DTOs (platform.Links, InventoryApi.Need, FilesApi.FileRef).

/** One "Benötigt" entry. A deleted item keeps its last name, has no stock and is marked deleted. */
export interface Need {
  itemId: string;
  name: string;
  quantity: number;
  stock: number | null;
  deleted: boolean;
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
