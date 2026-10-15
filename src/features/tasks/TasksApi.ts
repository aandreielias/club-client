import type { ApiClient } from '../../lib/http/ApiClient';
import type { NewTask, Task, TaskList, TaskPatch, TaskQuery, TaskStatus } from './model';

/** Typed access to the tasks endpoints of club-server. Every write answers with the updated task. */
export class TasksApi {
  static readonly BASE = '/api/v1/tasks';

  constructor(private readonly api: ApiClient) {}

  /** Visible tasks ordered by due date (undated last), without comments. */
  async list(query: TaskQuery): Promise<Task[]> {
    return (await this.api.get<TaskList>(TasksApi.BASE, { ...query })).items;
  }

  get(id: string): Promise<Task> {
    return this.api.get<Task>(this.path(id));
  }

  create(task: NewTask): Promise<Task> {
    return this.api.post<Task>(TasksApi.BASE, task);
  }

  update(id: string, patch: TaskPatch): Promise<Task> {
    return this.api.patch<Task>(this.path(id), patch);
  }

  setStatus(id: string, status: TaskStatus): Promise<Task> {
    return this.api.put<Task>(`${this.path(id)}/status`, { status });
  }

  check(id: string, itemId: string, done: boolean): Promise<Task> {
    return this.api.put<Task>(`${this.path(id)}/checklist/${encodeURIComponent(itemId)}`, { done });
  }

  comment(id: string, text: string): Promise<Task> {
    return this.api.post<Task>(`${this.path(id)}/comments`, { text });
  }

  delete(id: string): Promise<void> {
    return this.api.delete(this.path(id));
  }

  private path(id: string): string {
    return `${TasksApi.BASE}/${encodeURIComponent(id)}`;
  }
}
