import { FormState } from '../../lib/state/FormState.svelte';
import { settings } from '../../settings';
import type { Folder, FolderKind, FolderScope, NewFolder } from './model';

/** server: FilesController teamIds @Size(max = 20) */
export const MAX_FOLDER_TEAMS = 20;

export type FolderFormErrors = Partial<Record<'name' | 'team', string>>;

/** Name and teams of a folder, new or edited; {@code needsTeam}: a top-level TEAM folder. */
export function folderErrors(name: string, needsTeam: boolean, teamIds: readonly string[]): FolderFormErrors {
  const errors: FolderFormErrors = {};
  const max = settings.files.folderNameMaxLength;
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > max) errors.name = `Name mit 1 bis ${max} Zeichen angeben.`;
  if (needsTeam && !teamIds.length) errors.team = 'Mindestens ein Team auswählen.';
  if (teamIds.length > MAX_FOLDER_TEAMS) errors.team = `Höchstens ${MAX_FOLDER_TEAMS} Teams.`;
  return errors;
}

/** A new folder: at root level with its own scope, or a subfolder inheriting scope and team. */
export class FolderForm extends FormState<FolderFormErrors> {
  name = $state('');
  kind = $state<FolderKind>('DOCUMENTS');
  scope = $state<FolderScope>('CLUB');
  teamIds = $state<string[]>([]);
  membersCanUpload = $state(false);

  constructor(readonly parent: Folder | null, defaults: { scope: FolderScope; teamIds: string[] }) {
    super();
    if (parent) this.kind = parent.kind;
    this.scope = defaults.scope;
    this.teamIds = [...defaults.teamIds];
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

  protected validate(): FolderFormErrors {
    return folderErrors(this.name, !this.parent && this.scope === 'TEAM', this.teamIds);
  }
}
