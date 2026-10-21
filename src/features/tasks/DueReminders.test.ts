import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../lib/bus';
import { TOAST, type ToastRequest } from '../../lib/notify/ToastService.svelte';
import type { LocalStore } from '../../lib/storage/LocalStore';
import type { Formatter } from '../../lib/time/Formatter';
import { DueReminders } from './DueReminders';
import type { Task } from './model';
import type { TasksApi } from './TasksApi';

const task = (id: string, dueAt: string | null, status: Task['status'] = 'OPEN') => ({ id, title: `T${id}`, dueAt, status }) as Task;

function setup(tasks: Task[]) {
  const bus = new EventBus();
  const toasts: ToastRequest[] = [];
  bus.subscribe(TOAST, (t) => toasts.push(t));
  const saved = new Map<string, unknown>();
  const store = { get: (k: string) => saved.get(k) ?? null, set: (k: string, v: unknown) => saved.set(k, v) } as unknown as LocalStore;
  const api = { list: vi.fn(async () => tasks) } as unknown as TasksApi;
  const format = () => ({ dateTime: (s: string) => s }) as unknown as Formatter;
  return { reminders: new DueReminders(api, store, bus, format, { dueSoonHours: 24, checkEveryMs: 60_000, maxToasts: 2 }), toasts };
}

describe('DueReminders', () => {
  const now = new Date('2026-10-17T10:00:00Z');

  it('reminds of overdue and soon-due open tasks once per day', async () => {
    const { reminders, toasts } = setup([
      task('1', '2026-10-16T10:00:00Z'),
      task('2', '2026-10-18T09:00:00Z'),
      task('3', '2026-10-20T09:00:00Z'),
      task('4', null),
      task('5', '2026-10-17T12:00:00Z', 'DONE'),
    ]);
    await reminders.check(now);
    expect(toasts.map((t) => t.text)).toEqual(['Überfällig: „T1“ (2026-10-16T10:00:00Z)', 'Bald fällig: „T2“ (2026-10-18T09:00:00Z)']);
    await reminders.check(now);
    expect(toasts).toHaveLength(2);
  });

  it('sums up when there are many', async () => {
    const { reminders, toasts } = setup([task('1', '2026-10-17T11:00:00Z'), task('2', '2026-10-17T12:00:00Z'), task('3', '2026-10-17T13:00:00Z')]);
    await reminders.check(now);
    expect(toasts).toHaveLength(1);
    expect(toasts[0].text).toContain('3 deiner Aufgaben');
  });
});
