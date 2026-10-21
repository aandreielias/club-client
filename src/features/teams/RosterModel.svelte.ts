import type { TeamDirectory } from '../../lib/directory/TeamDirectory.svelte';
import { Action } from '../../lib/state/Action.svelte';
import { Resource } from '../../lib/state/Resource.svelte';
import type { Roster, RosterEntry, TeamRole } from '../../lib/types';
import type { TeamsApi } from './TeamsApi';

/** One team's roster and the membership changes made on the team page. */
export class RosterModel {
  readonly roster: Resource<Roster>;
  readonly assignAction = new Action();
  readonly removeAction = new Action();

  constructor(
    private readonly api: TeamsApi,
    private readonly directory: TeamDirectory,
    readonly teamId: string,
  ) {
    this.roster = new Resource(() => this.api.roster(this.teamId));
  }

  load(): Promise<void> {
    return this.roster.load();
  }

  get busy(): boolean {
    return this.assignAction.busy || this.removeAction.busy;
  }

  has(memberId: string): boolean {
    return !!this.roster.value?.entries.some((e) => e.memberId === memberId);
  }

  /** Adds a member or changes the role of an existing one. */
  assign(memberId: string, role: TeamRole): Promise<boolean> {
    return this.write(this.assignAction, () => this.api.setMember(this.teamId, memberId, role));
  }

  remove(entry: RosterEntry): Promise<boolean> {
    return this.write(this.removeAction, () => this.api.removeMember(this.teamId, entry.memberId));
  }

  private async write(action: Action, request: () => Promise<Roster>): Promise<boolean> {
    const updated = await action.attempt(request);
    if (!updated) return false;
    this.roster.set(updated);
    // Other pages resolve names and team roles from the cached roster.
    this.directory.forgetRoster(this.teamId);
    return true;
  }
}
