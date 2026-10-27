import { PlanningPolicy } from '../../lib/policy/PlanningPolicy';
import type { Task } from './model';

/**
 * Client-side mirror of the server's task rules (TaskHandlers.Viewer), used only to show or hide
 * actions; the server decides.
 */
export class TaskPolicy extends PlanningPolicy {
  /** Assigned to the member or one of their minors (server: Viewer.self). */
  isAssigned(task: Task): boolean {
    const self = [this.session.member.id, ...this.session.wardIds];
    return task.assignees.some((id) => self.includes(id));
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
}
