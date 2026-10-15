import { Action } from '../../lib/state/Action.svelte';
import { Resource } from '../../lib/state/Resource.svelte';
import type { FileLinks } from './FileLinks';
import type { FilesApi } from './FilesApi';
import type { StoredFile } from './model';

/** Files of one folder and the actions on them. */
export class FolderContents {
  readonly files: Resource<StoredFile[]>;
  readonly deleteAction = new Action();
  readonly tagAction = new Action();

  constructor(
    private readonly api: FilesApi,
    private readonly links: FileLinks,
    readonly folderId: string,
  ) {
    this.files = new Resource(() => this.api.files(this.folderId));
  }

  load(): Promise<void> {
    return this.files.load();
  }

  /** Newest first. */
  sorted(): StoredFile[] {
    return [...(this.files.value ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  added(file: StoredFile): void {
    const current = this.files.value ?? [];
    if (!current.some((f) => f.id === file.id)) this.files.set([...current, file]);
  }

  async delete(file: StoredFile): Promise<boolean> {
    const ok = await this.deleteAction.run(() => this.api.deleteFile(file.id));
    if (ok) {
      this.links.forget(file.id);
      this.files.set((this.files.value ?? []).filter((f) => f.id !== file.id));
    }
    return ok;
  }

  async tag(file: StoredFile, memberIds: readonly string[]): Promise<StoredFile | null> {
    let updated: StoredFile | null = null;
    await this.tagAction.run(async () => {
      updated = await this.api.tag(file.id, memberIds);
    });
    if (updated) {
      const next = updated as StoredFile;
      this.files.set((this.files.value ?? []).map((f) => (f.id === next.id ? next : f)));
    }
    return updated;
  }
}
