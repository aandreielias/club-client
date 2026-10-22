import type { ClubPermissions } from '../../lib/policy/ClubPermissions';
import type { SessionStore } from '../../lib/session/SessionStore.svelte';
import type { Team } from '../../lib/types';
import type { FileTypes } from './FileTypes';
import type { Folder, FolderScope, StoredFile } from './model';

/**
 * Client-side mirror of the server's file rules. Folder rights come from the server (`canUpload`,
 * `canManage`); file rights follow FileHandlers: the uploader or a folder manager.
 */
export class FilePolicy {
  constructor(
    private readonly session: SessionStore,
    private readonly permissions: ClubPermissions,
    private readonly types: FileTypes,
  ) {}

  /** Root folders: admin/board any scope, coaches team folders of their teams. */
  canCreateRoot(): boolean {
    return this.permissions.canManageAnything();
  }

  rootScopes(): readonly FolderScope[] {
    return this.permissions.isManager ? ['CLUB', 'TEAM', 'BOARD', 'ASSEMBLY'] : ['TEAM'];
  }

  rootTeams(): readonly Team[] {
    return this.permissions.manageableTeams();
  }

  canCreateIn(folder: Folder, depth: number, maxDepth: number): boolean {
    return folder.canManage && depth < maxDepth;
  }

  canModify(file: StoredFile, folder: Folder): boolean {
    return folder.canManage || file.uploadedBy === this.session.member.id;
  }

  canTag(file: StoredFile, folder: Folder): boolean {
    return this.types.isImage(file.contentType) && this.canModify(file, folder);
  }
}
