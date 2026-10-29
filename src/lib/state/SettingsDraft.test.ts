import { describe, expect, it } from 'vitest';
import { toggled } from '../../ui/options';
import { SettingsDraft } from './SettingsDraft.svelte';

describe('SettingsDraft', () => {
  it('knows when something changed, discards it and keeps what was saved', async () => {
    const draft = new SettingsDraft({ domain: 'verein.at', limit: 200 });
    expect(draft.dirty).toBe(false);
    draft.value.limit = 150;
    expect(draft.dirty).toBe(true);
    draft.reset();
    expect(draft.value).toEqual({ domain: 'verein.at', limit: 200 });

    draft.value.domain = 'Neu.at';
    // The server's answer becomes the saved state (here: normalised).
    expect(await draft.commit(async (v) => ({ ...v, domain: v.domain.toLowerCase() }))).toBe(true);
    expect(draft.value.domain).toBe('neu.at');
    expect(draft.dirty).toBe(false);

    draft.value.limit = 1;
    expect(await draft.commit(async () => Promise.reject(new Error('nein')))).toBe(false);
    expect(draft.dirty).toBe(true);
    expect(draft.save.error).toBeTruthy();
  });
});

describe('toggled', () => {
  it('switches one option and keeps the order of the options', () => {
    const all = ['SIMPLE', 'TWO_THIRDS', 'THREE_QUARTERS'];
    expect(toggled(['THREE_QUARTERS'], 'SIMPLE', all)).toEqual(['SIMPLE', 'THREE_QUARTERS']);
    expect(toggled(['SIMPLE', 'THREE_QUARTERS'], 'SIMPLE', all)).toEqual(['THREE_QUARTERS']);
  });
});
