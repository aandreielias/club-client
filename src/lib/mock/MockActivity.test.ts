import { describe, expect, it } from 'vitest';
import { directory } from './core';
import { activity, MockActivity } from './MockActivity';

const member = (id: string) => directory.members.data.find((m) => m.id === id)!;

describe('MockActivity', () => {
  it('stores recorded events newest first, readable by privileged members only', () => {
    MockActivity.record('TASK', 'x-1', member('trainer'), 'CREATED', { title: 'Bälle', teamIds: ['t-damen'] });
    MockActivity.record('TASK', 'x-1', member('spieler'), 'STATUS', { title: 'Bälle', teamIds: ['t-damen'], detail: 'DONE' });
    const { items } = activity.list(member('admin'), 'TASK', 'x-1');
    expect(items.map((e) => e.action)).toEqual(['STATUS', 'CREATED']);
    expect(items[0].actorId).toBe('spieler');
    expect(() => activity.list(member('spieler'), 'TASK', 'x-1')).toThrow(expect.objectContaining({ status: 403 }));
  });
});

describe('MockActivity feed', () => {
  it('admin sees everything, coaches only their teams, others nothing', () => {
    MockActivity.record('TASK', 'x-2', member('admin'), 'CREATED', { title: 'Vereinsfest', teamIds: [] });
    expect(activity.feed(member('admin'), null, null, 50).items.some((e) => e.recordId === 'x-2')).toBe(true);
    expect(activity.feed(member('trainer'), null, null, 50).items.some((e) => e.recordId === 'x-2')).toBe(false);
    expect(activity.feed(member('trainer'), 'TASK', null, 50).items.some((e) => e.recordId === 'x-1')).toBe(true);
    expect(() => activity.feed(member('spieler'), null, null, 50)).toThrow(expect.objectContaining({ status: 403 }));
  });
});
