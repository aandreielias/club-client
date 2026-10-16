import { settings } from '../../settings';
import type { FilePatch, Folder, FolderColor, FolderPatch, FolderScope, StoredFile } from './model';

export interface FolderEditErrors {
  name?: string;
  team?: string;
}

/** Edits an existing folder; `toPatch` sends only what changed. Visibility only on top-level folders. */
export class FolderEditForm {
  name = $state('');
  scope = $state<FolderScope>('CLUB');
  teamId = $state('');
  color = $state<FolderColor | null>(null);
  coverFileId = $state<string | null>(null);
  submitted = $state(false);

  readonly errors: FolderEditErrors;
  readonly valid: boolean;

  constructor(readonly folder: Folder) {
    this.name = folder.name;
    this.scope = folder.scope;
    this.teamId = folder.teamId ?? '';
    this.color = folder.color;
    this.coverFileId = folder.coverFileId;
    this.errors = $derived(this.validate());
    this.valid = $derived(Object.keys(this.errors).length === 0);
  }

  /** Subfolders follow their top-level folder (server: folder.scope-inherited). */
  get canChangeScope(): boolean {
    return this.folder.parentId === null;
  }

  error(field: keyof FolderEditErrors): string | null {
    return this.submitted ? (this.errors[field] ?? null) : null;
  }

  toPatch(): FolderPatch {
    const patch: FolderPatch = {};
    const name = this.name.trim();
    if (name !== this.folder.name) patch.name = name;
    const teamId = this.scope === 'TEAM' ? this.teamId || null : null;
    if (this.canChangeScope && (this.scope !== this.folder.scope || teamId !== this.folder.teamId)) {
      patch.scope = this.scope;
      patch.teamId = teamId;
    }
    if (this.color !== this.folder.color) {
      if (this.color) patch.color = this.color;
      else patch.clearColor = true;
    }
    if (this.coverFileId !== this.folder.coverFileId) {
      if (this.coverFileId) patch.coverFileId = this.coverFileId;
      else patch.clearCover = true;
    }
    return patch;
  }

  get changed(): boolean {
    return Object.keys(this.toPatch()).length > 0;
  }

  private validate(): FolderEditErrors {
    const errors: FolderEditErrors = {};
    const max = settings.files.folderNameMaxLength;
    const name = this.name.trim();
    if (!name || name.length > max) errors.name = `Name mit 1 bis ${max} Zeichen angeben.`;
    if (this.canChangeScope && this.scope === 'TEAM' && !this.teamId) errors.team = 'Team auswählen.';
    return errors;
  }
}

/** Renames a file (its extension stays) and/or moves it to another folder. */
export class FileEditForm {
  base = $state('');
  folderId = $state('');
  submitted = $state(false);

  readonly extension: string;
  readonly error: string | null;

  constructor(readonly file: StoredFile) {
    const dot = file.name.lastIndexOf('.');
    this.extension = dot > 0 ? file.name.slice(dot) : '';
    this.base = dot > 0 ? file.name.slice(0, dot) : file.name;
    this.folderId = file.folderId;
    this.error = $derived(this.submitted ? this.validate() : null);
  }

  get valid(): boolean {
    return this.validate() === null;
  }

  toPatch(): FilePatch {
    const patch: FilePatch = {};
    const name = this.base.trim() + this.extension;
    if (name !== this.file.name) patch.name = name;
    if (this.folderId !== this.file.folderId) patch.folderId = this.folderId;
    return patch;
  }

  private validate(): string | null {
    const base = this.base.trim();
    return base && base.length <= 100 ? null : 'Name mit 1 bis 100 Zeichen angeben.';
  }
}
