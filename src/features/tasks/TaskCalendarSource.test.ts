import { describe, expect, it } from 'vitest';
import type { Task } from './model';
import { TaskCalendarSource } from './TaskCalendarSource';
import { TaskListModel } from './TaskListModel.svelte';
import type { TasksApi } from './TasksApi';

const task = (id: string, dueAt: string | null, status: Task['status'] = 'OPEN'): Task => ({
  id, teamId: null, appointmentId: null, title: id, description: null, status, dueAt, createdBy: 'm', assignees: ['m'], checklist: [],
  comments: [], createdAt: '2026-01-01T00:00:00Z', completedAt: null,
});

describe('TaskCalendarSource', () => {
  it('returns due dates in range as all-day entries, done ones inactive', async () => {
    const api = { list: async () => [task('a', '2026-10-20T16:00:00.000Z'), task('b', null), task('c', '2026-12-01T00:00:00.000Z'), task('d', '2026-10-21T08:00:00.000Z', 'DONE')] };
    const entries = await new TaskCalendarSource(api as unknown as TasksApi).load('2026-10-19T00:00:00Z', '2026-10-26T00:00:00Z');
    expect(entries.map((e) => [e.key, e.allDay, e.inactive])).toEqual([['task:a', true, false], ['task:d', true, true]]);
    expect(entries[0].window).toEqual({ kind: 'task', id: 'a' });
  });
});

describe('TaskListModel due filter', () => {
  const now = new Date('2026-10-15T12:00:00Z');
  it('matches overdue, next week and undated tasks', () => {
    expect(TaskListModel.dueMatches(task('a', '2026-10-14T00:00:00Z'), 'overdue', now)).toBe(true);
    expect(TaskListModel.dueMatches(task('a', '2026-10-14T00:00:00Z', 'DONE'), 'overdue', now)).toBe(false);
    expect(TaskListModel.dueMatches(task('a', '2026-10-20T00:00:00Z'), 'week', now)).toBe(true);
    expect(TaskListModel.dueMatches(task('a', null), 'none', now)).toBe(true);
  });
});
