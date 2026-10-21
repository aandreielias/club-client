import type { TeamDirectory } from '../../lib/directory/TeamDirectory.svelte';
import { ListModel } from '../../lib/list/ListModel.svelte';
import type { LocalStore } from '../../lib/storage/LocalStore';
import { isOverdue, statusLabel, statusRank, TASK_STATUSES, type Task } from './model';
import type { TaskPolicy } from './TaskPolicy';
import type { TasksApi } from './TasksApi';

const DAY_MS = 86_400_000;

/** The task list: server filters (mine, team, done) plus client filters for status and due date. */
export class TaskListModel extends ListModel<Task> {
  constructor(api: TasksApi, policy: TaskPolicy, directory: TeamDirectory, store: LocalStore | null) {
    super(
      {
        id: 'tasks',
        load: (server) => api.list({ mine: server.mine === '1', teamId: server.team || null, includeDone: server.done === '1' }),
        defaultSort: { key: 'due', dir: 'asc' },
        searchText: (t) => `${t.title} ${t.description ?? ''}`,
        columns: [
          { key: 'title', label: 'Titel', value: (t) => t.title },
          { key: 'status', label: 'Status', value: (t) => statusRank(t.status), format: (t) => statusLabel(t.status), width: '8rem' },
          { key: 'due', label: 'Fällig', value: (t) => t.dueAt, width: '11rem' },
          { key: 'team', label: 'Für', value: (t) => (t.teamId ? (directory.teamName(t.teamId) ?? 'Team') : 'Verein'), width: '9rem' },
          {
            key: 'assignees',
            label: 'Zugewiesen',
            value: (t) => t.assignees.map((id) => directory.nameOf(id)).join(', '),
            hideOnCompact: true,
          },
          {
            key: 'checklist',
            label: 'Checkliste',
            value: (t) => (t.checklist.length ? t.checklist.filter((i) => i.done).length / t.checklist.length : null),
            format: (t) => (t.checklist.length ? `${t.checklist.filter((i) => i.done).length}/${t.checklist.length}` : ''),
            width: '6rem',
            align: 'end',
            hideOnCompact: true,
          },
        ],
        filters: [
          { key: 'mine', label: 'Nur meine', kind: 'toggle', initial: '1' },
          {
            key: 'team',
            label: 'Team',
            kind: 'select',
            allLabel: 'Alle Teams',
            options: () => policy.filterableTeams().map((t) => ({ value: t.id, label: t.name })),
          },
          {
            key: 'status',
            label: 'Status',
            kind: 'select',
            allLabel: 'Jeder Status',
            options: () => TASK_STATUSES.map((s) => ({ value: s.value, label: s.label })),
            test: (t, value) => t.status === value,
          },
          {
            key: 'dueIn',
            label: 'Fälligkeit',
            kind: 'select',
            allLabel: 'Jede Fälligkeit',
            options: () => [
              { value: 'overdue', label: 'Überfällig' },
              { value: 'week', label: 'Nächste 7 Tage' },
              { value: 'none', label: 'Ohne Termin' },
            ],
            test: (t, value) => TaskListModel.dueMatches(t, value, new Date()),
          },
          { key: 'done', label: 'Erledigte zeigen', kind: 'toggle' },
        ],
      },
      store,
    );
  }

  static dueMatches(task: Task, filter: string, now: Date): boolean {
    if (filter === 'none') return task.dueAt === null;
    if (!task.dueAt) return false;
    const due = Date.parse(task.dueAt);
    if (filter === 'overdue') return isOverdue(task, now);
    if (filter === 'week') return due >= now.getTime() && due < now.getTime() + 7 * DAY_MS;
    return true;
  }
}

