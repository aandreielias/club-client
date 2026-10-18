import { describe, expect, it } from 'vitest';
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
      title: 'Hallenwechsel', body: '', everyone: false, teamIds: ['t1'], memberIds: [], includeGuardians: true, refs: [{ kind: 'TASK', id: 'x' }],
    });
    form.audience = 'everyone';
    expect(form.errors.recipients).toBe('Nur Admin und Vorstand schreiben an alle.');
  });
});
