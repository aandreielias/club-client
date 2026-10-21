import { FormState } from '../../lib/state/FormState.svelte';
import { settings } from '../../settings';
import type { FilePatch, Folder, FolderColor, FolderPatch, FolderScope, StoredFile } from './model';
import { MAX_FOLDER_TEAMS } from './FolderForm.svelte';

export interface FolderEditErrors {
  name?: string;
  team?: string;
}

/** Edits an existing folder; `toPatch` sends only what changed. Visibility only on top-level folders. */
export class FolderEditForm extends FormState<FolderEditErrors> {
  name = $state('');
  scope = $state<FolderScope>('CLUB');
  teamIds = $state<string[]>([]);
  color = $state<FolderColor | null>(null);
  coverFileId = $state<string | null>(null);
  membersCanUpload = $state(false);

  constructor(readonly folder: Folder) {
    super();
    this.membersCanUpload = folder.membersCanUpload;
    this.name = folder.name;
    this.scope = folder.scope;
    this.teamIds = [...folder.teamIds];
    this.color = folder.color;
    this.coverFileId = folder.coverFileId;
  }

  /** Subfolders follow their top-level folder (server: folder.scope-inherited). */
  get canChangeScope(): boolean {
    return this.folder.parentId === null;
  }

  toPatch(): FolderPatch {
    const patch: FolderPatch = {};
    const name = this.name.trim();
    if (name !== this.folder.name) patch.name = name;
    const teamIds = this.scope === 'TEAM' ? [...this.teamIds].sort() : [];
    const sameTeams = teamIds.join() === [...this.folder.teamIds].sort().join();
    if (this.canChangeScope && (this.scope !== this.folder.scope || !sameTeams)) {
      patch.scope = this.scope;
      patch.teamIds = teamIds;
    }
    if (this.color !== this.folder.color) {
      if (this.color) patch.color = this.color;
      else patch.clearColor = true;
    }
    if (this.membersCanUpload !== this.folder.membersCanUpload) patch.membersCanUpload = this.membersCanUpload;
    if (this.coverFileId !== this.folder.coverFileId) {
      if (this.coverFileId) patch.coverFileId = this.coverFileId;
      else patch.clearCover = true;
    }
    return patch;
  }

  get changed(): boolean {
    return Object.keys(this.toPatch()).length > 0;
  }

  protected validate(): FolderEditErrors {
    const errors: FolderEditErrors = {};
    const max = settings.files.folderNameMaxLength;
    const name = this.name.trim();
    if (!name || name.length > max) errors.name = `Name mit 1 bis ${max} Zeichen angeben.`;
    if (this.canChangeScope && this.scope === 'TEAM' && !this.teamIds.length) errors.team = 'Mindestens ein Team auswählen.';
    if (this.teamIds.length > MAX_FOLDER_TEAMS) errors.team = `Höchstens ${MAX_FOLDER_TEAMS} Teams.`;
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
    // server: the whole name, extension included, has at most 100 characters
    const base = this.base.trim();
    const max = 100 - this.extension.length;
    return base && base.length <= max ? null : `Name mit 1 bis ${max} Zeichen angeben.`;
  }
}
