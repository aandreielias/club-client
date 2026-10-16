import { settings } from '../../settings';
import type { Folder, FolderKind, FolderScope, NewFolder } from './model';

export type FolderFormErrors = Partial<Record<'name' | 'team', string>>;

/** A new folder: at root level with its own scope, or a subfolder inheriting scope and team. */
export class FolderForm {
  name = $state('');
  kind = $state<FolderKind>('DOCUMENTS');
  scope = $state<FolderScope>('CLUB');
  teamIds = $state<string[]>([]);
  membersCanUpload = $state(false);
  submitted = $state(false);

  readonly errors: FolderFormErrors;
  readonly valid: boolean;

  constructor(readonly parent: Folder | null, defaults: { scope: FolderScope; teamIds: string[] }) {
    if (parent) this.kind = parent.kind;
    this.scope = defaults.scope;
    this.teamIds = [...defaults.teamIds];
    this.errors = $derived(this.validate());
    this.valid = $derived(Object.keys(this.errors).length === 0);
  }

  error(field: keyof FolderFormErrors): string | null {
    return this.submitted ? (this.errors[field] ?? null) : null;
  }

  toNew(): NewFolder {
    return {
      parentId: this.parent?.id ?? null,
      name: this.name.trim(),
      kind: this.kind,
      scope: this.parent ? null : this.scope,
      teamIds: !this.parent && this.scope === 'TEAM' ? this.teamIds : [],
      membersCanUpload: this.membersCanUpload,
    };
  }

  private validate(): FolderFormErrors {
    const errors: FolderFormErrors = {};
    const max = settings.files.folderNameMaxLength;
    const name = this.name.trim();
    if (!name || name.length > max) errors.name = `Name mit 1 bis ${max} Zeichen angeben.`;
    if (!this.parent && this.scope === 'TEAM' && !this.teamIds.length) errors.team = 'Mindestens ein Team auswählen.';
    return errors;
  }
}
