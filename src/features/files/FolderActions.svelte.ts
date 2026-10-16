import { SvelteSet } from 'svelte/reactivity';
import type { EventBus } from '../../lib/bus';
import { APP_ERROR } from '../../lib/errors/ErrorReporter';
import { BrowserFile } from '../../lib/files/BrowserFile';
import { TOAST } from '../../lib/notify/ToastService.svelte';
import type { PendingDeletes } from '../../lib/state/PendingDeletes.svelte';
import type { FileMover } from './FileMover';
import type { FilePolicy } from './FilePolicy';
import type { FilesApi } from './FilesApi';
import type { FolderContents } from './FolderContents.svelte';
import type { FolderTree } from './FolderTree.svelte';
import type { FolderZip } from './FolderZip';
import type { Folder, StoredFile } from './model';

export interface FolderActionsDeps {
  bus: EventBus;
  api: FilesApi;
  policy: FilePolicy;
  mover: FileMover;
  zip: FolderZip;
  deletes: PendingDeletes;
  tree: FolderTree;
  /** Files of the open folder; null on the root page (folders only). */
  contents: FolderContents | null;
  /** The open folder, once the tree is loaded. */
  folder: () => Folder | undefined;
  /** Reloads the listing after a change. */
  reload: () => void;
}

/**
 * What the file page does with files besides showing them: the selection, moving (also by drag
 * and drop), deleting with undo and downloading as ZIP.
 */
export class FolderActions {
  readonly selected = new SvelteSet<string>();
  zipping = $state(false);

  /** Selected files that are still there (not waiting for their delete). */
  readonly selectedFiles: StoredFile[];

  constructor(private readonly deps: FolderActionsDeps) {
    this.selectedFiles = $derived(this.files.filter((f) => this.selected.has(f.id) && !deps.deletes.isHidden(f.id)));
  }

  private get files(): StoredFile[] {
    return this.deps.contents?.files.value ?? [];
  }

  toggle(id: string): void {
    if (this.selected.has(id)) this.selected.delete(id);
    else this.selected.add(id);
  }

  /** A dragged file that is selected carries the whole selection. */
  dragged(id: string): string[] {
    return this.selected.has(id) ? [...this.selected] : [id];
  }

  canModify(file: StoredFile): boolean {
    const folder = this.deps.folder();
    return !!folder && this.deps.policy.canModify(file, folder);
  }

  async moveTo(ids: readonly string[], target: Folder): Promise<void> {
    const files = this.files.filter((f) => ids.includes(f.id));
    const folder = this.deps.folder();
    if (!folder || !this.deps.mover.canMove(files, folder, target)) {
      this.deps.bus.publish(TOAST, { text: 'In diesen Ordner kannst du diese Dateien nicht verschieben.', tone: 'error' });
      return;
    }
    await this.deps.mover.move(files, target);
    this.moved();
  }

  /** After a move (also from the dialog): nothing stays selected. */
  moved(): void {
    this.selected.clear();
    this.deps.reload();
  }

  /** Files disappear at once; the toast offers "Rückgängig" before the server deletes them. */
  remove(files: readonly StoredFile[]): void {
    const allowed = files.filter((f) => this.canModify(f));
    if (!allowed.length) return;
    this.deps.deletes.schedule({
      ids: allowed.map((f) => f.id),
      text: allowed.length === 1 ? `„${allowed[0].name}“ gelöscht.` : `${allowed.length} Dateien gelöscht.`,
      commit: async () => {
        for (const f of allowed) await this.deps.api.deleteFile(f.id);
        this.deps.reload();
      },
    });
    allowed.forEach((f) => this.selected.delete(f.id));
  }

  /** The folder with its subfolders, or only `files`, as one ZIP file. */
  async zip(target: Folder, files?: readonly StoredFile[]): Promise<void> {
    const { bus, zip, tree } = this.deps;
    this.zipping = true;
    try {
      const entries = files ? files.map((file) => ({ path: file.name, file })) : await zip.entries(target, tree);
      if (!entries.length) {
        bus.publish(TOAST, { text: 'Der Ordner ist leer.' });
        return;
      }
      BrowserFile.save(await zip.build(entries), `${target.name}.zip`);
      bus.publish(TOAST, { text: `ZIP mit ${entries.length} ${entries.length === 1 ? 'Datei' : 'Dateien'} heruntergeladen.` });
    } catch (error) {
      bus.publish(APP_ERROR, error);
    } finally {
      this.zipping = false;
    }
  }
}
