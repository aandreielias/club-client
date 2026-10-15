import type { ApiClient } from '../http/ApiClient';
import type { FileOption, ItemOption, Links, NeedInput } from './model';

interface ItemList {
  items: { id: string; name: string; category: string | null; quantity: number }[];
}

interface FolderList {
  items: { id: string; name: string }[];
}

interface FileList {
  items: { id: string; folderId: string; name: string; contentType: string; sizeBytes: number }[];
}

/**
 * The `/links` endpoints of appointments and tasks, plus the read-only lookups the pickers need
 * (inventory, folders, files). Lives in lib so calendar and tasks share it without importing the
 * inventory or files features.
 */
export class LinksApi {
  constructor(private readonly api: ApiClient) {}

  /** `owner` is the resource path, e.g. `/api/v1/tasks/t-1`. */
  get(owner: string): Promise<Links> {
    return this.api.get<Links>(`${owner}/links`);
  }

  /** Replaces both lists; answers with the resolved result. */
  set(owner: string, needs: readonly NeedInput[], fileIds: readonly string[]): Promise<Links> {
    return this.api.put<Links>(`${owner}/links`, { needs, fileIds });
  }

  async items(): Promise<ItemOption[]> {
    const { items } = await this.api.get<ItemList>('/api/v1/inventory');
    return items.map((i) => ({ id: i.id, name: i.name, stock: i.quantity, label: i.category ? `${i.name} (${i.category})` : i.name }));
  }

  /**
   * Every file in every visible folder, labelled "Ordner / Datei".
   * shortcut: one request per folder, fine for a club's few folders; use a search endpoint once the server has one.
   */
  async files(): Promise<FileOption[]> {
    const { items: folders } = await this.api.get<FolderList>('/api/v1/folders');
    const lists = await Promise.all(
      folders.map(async (folder) => {
        const { items } = await this.api.get<FileList>(`/api/v1/folders/${encodeURIComponent(folder.id)}/files`);
        return items.map((f) => ({
          id: f.id,
          label: `${folder.name} / ${f.name}`,
          file: { id: f.id, folderId: f.folderId, name: f.name, contentType: f.contentType, sizeBytes: f.sizeBytes, deleted: false },
        }));
      }),
    );
    return lists.flat().sort((a, b) => a.label.localeCompare(b.label, 'de'));
  }

  /** Short-lived download link of a file. */
  async downloadUrl(fileId: string): Promise<string> {
    return (await this.api.get<{ url: string }>(`/api/v1/files/${encodeURIComponent(fileId)}/link`, { thumbnail: false })).url;
  }
}
