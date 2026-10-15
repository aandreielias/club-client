import { Resource } from '../../lib/state/Resource.svelte';
import type { FilesApi } from './FilesApi';
import type { Folder } from './model';

/** All visible folders, with tree navigation helpers (the server returns a flat list). */
export class FolderTree {
  readonly folders: Resource<Folder[]>;

  constructor(
    private readonly api: FilesApi,
    readonly maxDepth: number,
  ) {
    this.folders = new Resource(() => this.api.folders());
  }

  load(): Promise<void> {
    return this.folders.load();
  }

  get(id: string): Folder | undefined {
    return this.folders.value?.find((f) => f.id === id);
  }

  /** Children of a folder, or the roots for null. Folders whose parent is invisible count as roots. */
  children(parentId: string | null): Folder[] {
    const all = this.folders.value ?? [];
    return all
      .filter((f) => (parentId === null ? !f.parentId || !all.some((p) => p.id === f.parentId) : f.parentId === parentId))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** From the root down to the folder itself. */
  path(id: string): Folder[] {
    const path: Folder[] = [];
    for (let folder = this.get(id); folder && path.length <= this.maxDepth; folder = folder.parentId ? this.get(folder.parentId) : undefined) {
      path.unshift(folder);
    }
    return path;
  }

  /** 1 for root folders. */
  depth(id: string): number {
    return this.path(id).length;
  }

  canHaveSubfolders(id: string): boolean {
    return this.depth(id) < this.maxDepth;
  }

  /** Adds a newly created folder without reloading the list. */
  add(folder: Folder): void {
    this.folders.set([...(this.folders.value ?? []), folder]);
  }

  remove(id: string): void {
    this.folders.set((this.folders.value ?? []).filter((f) => f.id !== id));
  }
}
