import { describe, expect, it } from 'vitest';
import { directory } from './core';
import { activity, MockActivity } from './MockActivity';

const member = (id: string) => directory.members.data.find((m) => m.id === id)!;

describe('MockActivity', () => {
  it('stores recorded events newest first, readable by privileged members only', () => {
    MockActivity.record('TASK', 'x-1', member('trainer'), 'CREATED', 'Bälle');
    MockActivity.record('TASK', 'x-1', member('spieler'), 'STATUS', 'DONE');
    const { items } = activity.list(member('admin'), 'TASK', 'x-1');
    expect(items.map((e) => e.action)).toEqual(['STATUS', 'CREATED']);
    expect(items[0].actorId).toBe('spieler');
    expect(() => activity.list(member('spieler'), 'TASK', 'x-1')).toThrow(expect.objectContaining({ status: 403 }));
  });
});
