import { Action } from '../../lib/state/Action.svelte';
import { Resource } from '../../lib/state/Resource.svelte';
import type { FileLinks } from './FileLinks';
import type { FilesApi } from './FilesApi';
import type { StoredFile } from './model';

/** Files of one folder and the actions on them. */
export class FolderContents {
  readonly files: Resource<StoredFile[]>;
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

  added(file: StoredFile): void {
    const current = this.files.value ?? [];
    if (!current.some((f) => f.id === file.id)) this.files.set([...current, file]);
  }

  async tag(file: StoredFile, memberIds: readonly string[]): Promise<StoredFile | null> {
    const updated = await this.tagAction.attempt(() => this.api.tag(file.id, memberIds));
    if (updated) this.files.set((this.files.value ?? []).map((f) => (f.id === updated.id ? updated : f)));
    return updated;
  }
}
