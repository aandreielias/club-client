import type { ClubPermissions } from '../../lib/policy/ClubPermissions';
import type { SessionStore } from '../../lib/session/SessionStore.svelte';
import type { Team } from '../../lib/types';
import type { Task } from './model';

/**
 * Client-side mirror of the server's task rules (TaskHandlers.Viewer), used only to show or hide
 * actions; the server decides. Tasks of a member's minors are not recognised as "own" yet.
 */
export class TaskPolicy {
  constructor(
    private readonly session: SessionStore,
    private readonly permissions: ClubPermissions,
  ) {}

  canCreate(): boolean {
    return this.permissions.canManageAnything();
  }

  canCreateClubWide(): boolean {
    return this.permissions.canManageClubWide();
  }

  plannableTeams(): readonly Team[] {
    return this.permissions.manageableTeams();
  }

  filterableTeams(): readonly Team[] {
    return this.permissions.filterableTeams();
  }

  isAssigned(task: Task): boolean {
    return task.assignees.includes(this.session.member.id);
  }

  /** Edit details, delete. */
  canManage(task: Task): boolean {
    return this.permissions.canManage(task.teamId);
  }

  /** Change status, tick checklist items. */
  canWork(task: Task): boolean {
    return (
      this.permissions.isManager ||
      task.createdBy === this.session.member.id ||
      this.isAssigned(task) ||
      (task.teamId !== null && this.permissions.isCoachOf(task.teamId))
    );
  }

  isOverdue(task: Task, now: Date = new Date()): boolean {
    return task.status !== 'DONE' && task.dueAt !== null && new Date(task.dueAt) < now;
  }

  isDueSoon(task: Task, withinHours: number, now: Date = new Date()): boolean {
    if (task.status === 'DONE' || task.dueAt === null) return false;
    const due = new Date(task.dueAt).getTime();
    return due >= now.getTime() && due - now.getTime() <= withinHours * 3_600_000;
  }
}
