import type { CalendarEntry, CalendarSource } from '../../lib/calendar/CalendarSources';
import type { Task } from './model';
import type { TasksApi } from './TasksApi';

/** Puts the due dates of visible tasks in the range into the calendar (done ones struck through). */
export class TaskCalendarSource implements CalendarSource {
  readonly id = 'tasks';
  readonly label = 'Aufgaben';

  constructor(private readonly api: TasksApi) {}

  async load(from: string, to: string): Promise<CalendarEntry[]> {
    const tasks = await this.api.list({ mine: false, teamId: null, includeDone: true, dueFrom: from, dueTo: to });
    return tasks.filter((t) => t.dueAt !== null).map(TaskCalendarSource.entry);
  }

  static entry(task: Task): CalendarEntry {
    return {
      key: `task:${task.id}`,
      source: 'tasks',
      title: task.title,
      start: task.dueAt!,
      end: null,
      allDay: true,
      hue: task.status === 'DONE' ? 'green' : 'orange',
      teamId: task.teamId,
      inactive: task.status === 'DONE',
      label: 'Fällig',
      window: { kind: 'task', id: task.id },
    };
  }
}
