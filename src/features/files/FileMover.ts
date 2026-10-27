import type { EventBus } from '../../lib/bus';
import { APP_ERROR } from '../../lib/errors/ErrorReporter';
import { TOAST } from '../../lib/notify/ToastService.svelte';
import type { FilesApi } from './FilesApi';
import type { FileTypes } from './FileTypes';
import type { Folder, StoredFile } from './model';

/**
 * Moves files between folders (drag and drop, "Verschieben" for a selection). Moving changes who
 * sees a file, so it needs the right to manage both folders; photo folders take photos only.
 */
export class FileMover {
  constructor(
    private readonly api: FilesApi,
    private readonly types: FileTypes,
    private readonly bus: EventBus,
  ) {}

  /** Whether these files may go from `source` into `target`. */
  canMove(files: readonly StoredFile[], source: Folder, target: Folder): boolean {
    return (
      files.length > 0 &&
      target.id !== source.id &&
      source.canManage &&
      target.canManage &&
      (target.kind === 'DOCUMENTS' || files.every((f) => this.types.isImage(f.contentType)))
    );
  }

  /** Moves one after another; reports how many arrived. Resolves true when all did. */
  async move(files: readonly StoredFile[], target: Folder): Promise<boolean> {
    let moved = 0;
    for (const file of files) {
      try {
        await this.api.updateFile(file.id, { folderId: target.id });
        moved++;
      } catch (error) {
        this.bus.publish(APP_ERROR, error);
        break;
      }
    }
    if (moved)
      this.bus.publish(TOAST, { text: moved === 1 ? `Nach „${target.name}“ verschoben.` : `${moved} Dateien nach „${target.name}“ verschoben.` });
    return moved === files.length;
  }

  /** Drag data: the ids of the dragged files. */
  static readonly DRAG_TYPE = 'application/x-club-files';
}
