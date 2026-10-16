import type { Person } from '../../lib/directory/PersonListModel.svelte';
import type { TeamDirectory } from '../../lib/directory/TeamDirectory.svelte';
import type { ClubPermissions } from '../../lib/policy/ClubPermissions';
import type { SessionStore } from '../../lib/session/SessionStore.svelte';
import type { Folder } from './model';

/**
 * Who can be marked on photos of a folder: its teams' members, for club folders the member list
 * (admin/board) or the member's own teams. Used by tagging a photo and by tagging at upload.
 */
export class TagCandidates {
  constructor(
    private readonly directory: TeamDirectory,
    private readonly permissions: ClubPermissions,
    private readonly session: SessionStore,
  ) {}

  async load(folder: Folder): Promise<Person[]> {
    await this.directory.loadRosters(); // team column and filter
    if (folder.teamIds.length) return TagCandidates.unique(await Promise.all(folder.teamIds.map((id) => this.directory.candidates(id))));
    if (this.permissions.isManager) return [...(await this.directory.candidates(null))];
    const rosters = await Promise.all(this.session.teams.map((t) => this.directory.roster(t.id)));
    return TagCandidates.unique(rosters.map((r) => r?.entries ?? []));
  }

  private static unique(lists: readonly (readonly Person[])[]): Person[] {
    return [...new Map(lists.flat().map((p) => [p.memberId, { memberId: p.memberId, name: p.name }] as const)).values()];
  }
}
