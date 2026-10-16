import { describe, expect, it } from 'vitest';
import { RecentRecords } from './RecentRecords.svelte';

describe('RecentRecords', () => {
  it('keeps the newest first, without duplicates, up to the limit', () => {
    const recent = new RecentRecords(null, 2);
    recent.remember({ kind: 'task', id: '1', title: 'A' });
    recent.remember({ kind: 'item', id: '2', title: 'B' });
    recent.remember({ kind: 'task', id: '1', title: 'A neu' });
    expect(recent.items.map((r) => r.title)).toEqual(['A neu', 'B']);
    recent.remember({ kind: 'team', id: '3', title: 'C' });
    expect(recent.items.map((r) => r.id)).toEqual(['3', '1']);
    recent.forget('team', '3');
    expect(recent.items.map((r) => r.id)).toEqual(['1']);
  });
});
