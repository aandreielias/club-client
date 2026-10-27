import { describe, expect, it } from 'vitest';
import { settings } from '../../settings';
import { MessageForm } from './MessageForm.svelte';

describe('MessageForm', () => {
  it('needs a title and someone to write to; only the chosen audience is sent', () => {
    const form = new MessageForm(false);
    expect(Object.keys(form.errors).sort()).toEqual(['recipients', 'title']);
    form.title = '  Hallenwechsel ';
    form.toggleTeam('t1');
    form.memberIds = ['m1'];
    expect(form.valid).toBe(true);
    form.addRef({ kind: 'TASK', id: 'x', title: 'Bälle' });
    form.addRef({ kind: 'TASK', id: 'x', title: 'Bälle' });
    expect(form.toMessage()).toEqual({
      title: 'Hallenwechsel',
      body: '',
      everyone: false,
      teamIds: ['t1'],
      memberIds: [],
      includeGuardians: true,
      refs: [{ kind: 'TASK', id: 'x' }],
    });
    form.audience = 'everyone';
    expect(form.errors.recipients).toBe('Nur Admin und Vorstand schreiben an alle.');
  });
});

describe('MessageForm drops', () => {
  it('links dropped records once, files by their own id, and refuses unknown kinds and more than the limit', () => {
    const form = new MessageForm(true);
    expect(form.addRecord({ kind: 'file', id: 'folder-1:file-1', title: 'Plan.pdf' })).toBe(true);
    expect(form.refs).toEqual([{ kind: 'FILE', id: 'file-1', title: 'Plan.pdf' }]);
    expect(form.addRecord({ kind: 'file', id: 'folder-1:file-1', title: 'Plan.pdf' })).toBe(false);
    expect(form.addRecord({ kind: 'settings', id: 'x', title: 'Einstellungen' })).toBe(false);
    for (let i = 0; i < settings.notifications.message.maxRefs + 2; i++) form.addRecord({ kind: 'team', id: `t${i}`, title: `Team ${i}` });
    expect(form.refs).toHaveLength(settings.notifications.message.maxRefs);
    expect(form.refs[1]).toEqual({ kind: 'TEAM', id: 't0', title: 'Team 0' });
  });
});
