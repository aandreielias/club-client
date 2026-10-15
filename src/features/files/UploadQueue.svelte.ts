import type { ErrorMessages } from '../../lib/errors/ErrorMessages';
import type { FileTypes } from './FileTypes';
import type { FilesApi } from './FilesApi';
import type { Folder, StoredFile } from './model';

export type UploadState = 'waiting' | 'uploading' | 'done' | 'failed';

export interface UploadItem {
  key: number;
  file: File;
  state: UploadState;
  /** 0..1 */
  progress: number;
  error: string | null;
}

/**
 * Uploads files to one folder, one after another (the server processes images in a few slots
 * only). Size and extension are checked before sending; the server still checks the content.
 */
export class UploadQueue {
  items = $state<UploadItem[]>([]);
  readonly busy: boolean;

  #next = 0;
  #running = false;

  constructor(
    private readonly api: FilesApi,
    private readonly types: FileTypes,
    private readonly errors: ErrorMessages,
    private readonly maxBytes: number,
    private readonly folder: () => Folder,
    private readonly onUploaded: (file: StoredFile) => void,
  ) {
    this.busy = $derived(this.items.some((i) => i.state === 'waiting' || i.state === 'uploading'));
  }

  add(files: Iterable<File>): void {
    for (const file of files) {
      const error = this.precheck(file);
      this.items.push({ key: this.#next++, file, state: error ? 'failed' : 'waiting', progress: 0, error });
    }
    void this.run();
  }

  /** Removes finished and failed entries from the list. */
  clearFinished(): void {
    this.items = this.items.filter((i) => i.state === 'waiting' || i.state === 'uploading');
  }

  private precheck(file: File): string | null {
    const folder = this.folder();
    if (!this.types.allows(folder.kind, file.name)) return `Dateityp nicht erlaubt. Erlaubt: ${this.types.describe(folder.kind)}.`;
    if (file.size > this.maxBytes) return `Zu groß (höchstens ${Math.floor(this.maxBytes / 1024 / 1024)} MB).`;
    if (file.size === 0) return 'Die Datei ist leer.';
    return null;
  }

  private async run(): Promise<void> {
    if (this.#running) return;
    this.#running = true;
    try {
      for (let item = this.nextWaiting(); item; item = this.nextWaiting()) await this.upload(item);
    } finally {
      this.#running = false;
    }
  }

  private nextWaiting(): UploadItem | undefined {
    return this.items.find((i) => i.state === 'waiting');
  }

  private async upload(item: UploadItem): Promise<void> {
    item.state = 'uploading';
    try {
      const stored = await this.api.upload(this.folder().id, item.file, [], ({ loaded, total }) => {
        item.progress = total > 0 ? Math.min(1, loaded / total) : 0;
      });
      item.progress = 1;
      item.state = 'done';
      this.onUploaded(stored);
    } catch (error) {
      item.state = 'failed';
      item.error = this.errors.text(error);
    }
  }
}
