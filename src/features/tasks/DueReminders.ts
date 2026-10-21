import type { EventBus } from '../../lib/bus';
import { TOAST } from '../../lib/notify/ToastService.svelte';
import { NAVIGATE } from '../../lib/router/Router.svelte';
import type { LocalStore } from '../../lib/storage/LocalStore';
import type { Formatter } from '../../lib/time/Formatter';
import { WINDOW_OPEN } from '../../lib/window/WindowService.svelte';
import type { Task } from './model';
import type { TasksApi } from './TasksApi';

export interface ReminderOptions {
  /** Open tasks due within this many hours (or overdue) are mentioned. */
  dueSoonHours: number;
  /** How often to look again while signed in. */
  checkEveryMs: number;
  /** More than this many: one summary instead of one toast each. */
  maxToasts: number;
}

/**
 * In-app reminders for the member's own open tasks that are due soon or overdue: a toast with
 * "Öffnen", at most once per task and day (remembered per browser).
 */
export class DueReminders {
  static readonly KEY = 'due-reminders';

  constructor(
    private readonly api: TasksApi,
    private readonly store: LocalStore,
    private readonly bus: EventBus,
    private readonly format: () => Formatter,
    private readonly options: ReminderOptions,
    /** The club's calendar day, so "shown today" turns over at local midnight, not UTC. */
    private readonly today: (now: Date) => string = (now) => now.toISOString().slice(0, 10),
  ) {}

  /** Session hook: checks now and then regularly; returns the cleanup. */
  start(): () => void {
    void this.check();
    const timer = setInterval(() => void this.check(), this.options.checkEveryMs);
    return () => clearInterval(timer);
  }

  async check(now: Date = new Date()): Promise<void> {
    let tasks: Task[];
    try {
      tasks = await this.api.list({ mine: true, teamId: null, includeDone: false });
    } catch {
      return; // reminders are a convenience; the task list shows errors itself
    }
    const today = this.today(now);
    const shown = this.store.get<Record<string, string>>(DueReminders.KEY) ?? {};
    const due = DueReminders.due(tasks, now, this.options.dueSoonHours).filter((t) => shown[t.id] !== today);
    if (!due.length) return;
    if (due.length > this.options.maxToasts) {
      this.bus.publish(TOAST, { text: `${due.length} deiner Aufgaben sind bald oder schon fällig.`, action: { label: 'Anzeigen', run: () => this.bus.publish(NAVIGATE, { path: '/tasks' }) } });
    } else {
      for (const task of due) {
        const overdue = Date.parse(task.dueAt!) < now.getTime();
        this.bus.publish(TOAST, {
          text: `${overdue ? 'Überfällig' : 'Bald fällig'}: „${task.title}“ (${this.format().dateTime(task.dueAt!)})`,
          action: { label: 'Öffnen', run: () => this.bus.publish(WINDOW_OPEN, { kind: 'task', id: task.id }) },
        });
      }
    }
    // Keep only today's marks, so the store does not grow.
    this.store.set(DueReminders.KEY, Object.fromEntries([...Object.entries(shown).filter(([, day]) => day === today), ...due.map((t) => [t.id, today])]));
  }

  /** Open tasks with a due date before `now + hours`, soonest first. */
  static due(tasks: readonly Task[], now: Date, hours: number): Task[] {
    const limit = now.getTime() + hours * 3_600_000;
    return tasks
      .filter((t) => t.status !== 'DONE' && t.dueAt && Date.parse(t.dueAt) <= limit)
      .sort((a, b) => a.dueAt!.localeCompare(b.dueAt!));
  }
}
