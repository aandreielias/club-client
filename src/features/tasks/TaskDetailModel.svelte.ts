import { Action } from '../../lib/state/Action.svelte';
import { Resource } from '../../lib/state/Resource.svelte';
import type { TasksApi } from './TasksApi';
import type { ChecklistItem, Task, TaskStatus } from './model';

/** One task with the actions of its detail page. Every write answers with the updated task. */
export class TaskDetailModel {
  readonly task: Resource<Task>;
  readonly statusAction = new Action();
  readonly checkAction = new Action();
  readonly commentAction = new Action();
  readonly deleteAction = new Action();
  readonly dueAction = new Action();

  /** Checklist item whose change is in flight. */
  pendingItem = $state<string | null>(null);

  constructor(
    private readonly api: TasksApi,
    readonly id: string,
  ) {
    this.task = new Resource(() => this.api.get(this.id));
  }

  load(): Promise<void> {
    return this.task.load();
  }

  setStatus(status: TaskStatus): Promise<boolean> {
    return this.write(this.statusAction, () => this.api.setStatus(this.id, status));
  }

  async toggle(item: ChecklistItem): Promise<boolean> {
    this.pendingItem = item.id;
    try {
      return await this.write(this.checkAction, () => this.api.check(this.id, item.id, !item.done));
    } finally {
      this.pendingItem = null;
    }
  }

  /** Sets a new due instant (the server cannot remove a due date, only change it). */
  setDue(dueAt: string): Promise<boolean> {
    return this.write(this.dueAction, () => this.api.update(this.id, { dueAt }));
  }

  addComment(text: string): Promise<boolean> {
    return this.write(this.commentAction, () => this.api.comment(this.id, text.trim()));
  }

  delete(): Promise<boolean> {
    return this.deleteAction.run(() => this.api.delete(this.id));
  }

  /** Checklist progress, e.g. { done: 2, total: 5 }. */
  static progress(task: Task): { done: number; total: number } {
    return { done: task.checklist.filter((i) => i.done).length, total: task.checklist.length };
  }

  private async write(action: Action, request: () => Promise<Task>): Promise<boolean> {
    let updated: Task | null = null;
    const ok = await action.run(async () => {
      updated = await request();
    });
    if (updated) this.task.set(updated);
    return ok;
  }
}
