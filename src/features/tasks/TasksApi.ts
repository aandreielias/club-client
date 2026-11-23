import type { ApiClient } from '../../lib/http/ApiClient';
import type { Reach } from '../../lib/reach';
import type {
  NewTask,
  Task,
  TaskLabel,
  TaskLabelInput,
  TaskList,
  TaskPatch,
  TaskQuery,
  TaskSettings,
  TaskStage,
  TaskStageInput,
  TaskStatus,
} from './model';

/** Typed access to the tasks endpoints of club-server. Every write answers with the updated task. */
export class TasksApi {
  static readonly BASE = '/api/v1/tasks';

  constructor(private readonly api: ApiClient) {}

  /** Admin and board: how long before the due time the reminder goes out. */
  settings(): Promise<TaskSettings> {
    return this.api.get<TaskSettings>(`${TasksApi.BASE}/settings`);
  }

  saveSettings(settings: TaskSettings): Promise<TaskSettings> {
    return this.api.put<TaskSettings>(`${TasksApi.BASE}/settings`, settings);
  }

  /** Who an audience reaches, as member ids (admin, board, coaches): the possible assignees. */
  async audienceMembers(audience: Reach): Promise<string[]> {
    return (await this.api.post<{ memberIds: string[] }>(`${TasksApi.BASE}/audience-members`, audience)).memberIds;
  }

  /** Visible tasks ordered by due date (undated last), without comments. */
  list(query: TaskQuery): Promise<TaskList> {
    return this.api.get<TaskList>(TasksApi.BASE, { ...query });
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
    return this.api.put<Task>(`${this.path(id)}/status`, { status, stage: null });
  }

  /** Moves the task to one of the club's statuses (its phase follows). */
  setStage(id: string, stage: string): Promise<Task> {
    return this.api.put<Task>(`${this.path(id)}/status`, { status: null, stage });
  }

  async stages(): Promise<TaskStage[]> {
    return (await this.api.get<{ items: TaskStage[] }>(`${TasksApi.BASE}/stages`)).items;
  }

  /** `key` null = new (admin, board). */
  saveStage(key: string | null, input: TaskStageInput): Promise<TaskStage> {
    return key
      ? this.api.put<TaskStage>(`${TasksApi.BASE}/stages/${encodeURIComponent(key)}`, input)
      : this.api.post<TaskStage>(`${TasksApi.BASE}/stages`, input);
  }

  deleteStage(key: string): Promise<void> {
    return this.api.delete(`${TasksApi.BASE}/stages/${encodeURIComponent(key)}`);
  }

  async labels(): Promise<TaskLabel[]> {
    return (await this.api.get<{ items: TaskLabel[] }>(`${TasksApi.BASE}/labels`)).items;
  }

  saveLabel(key: string | null, input: TaskLabelInput): Promise<TaskLabel> {
    return key
      ? this.api.put<TaskLabel>(`${TasksApi.BASE}/labels/${encodeURIComponent(key)}`, input)
      : this.api.post<TaskLabel>(`${TasksApi.BASE}/labels`, input);
  }

  deleteLabel(key: string): Promise<void> {
    return this.api.delete(`${TasksApi.BASE}/labels/${encodeURIComponent(key)}`);
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
