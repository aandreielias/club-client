import { describe, expect, it } from 'vitest';
import { NO_STATUTES, type ActionRule, type ResolutionRules } from './model';
import { createdAction, ResolutionRuleForm, withRule } from './ResolutionRuleForm.svelte';

const rule = (action: string, extra: Partial<ActionRule> = {}): ActionRule => ({
  action,
  label: null,
  majority: null,
  enabled: true,
  followUps: [],
  ...extra,
});
const rules = (...items: ActionRule[]): ResolutionRules => ({ items, circular: { minHours: 72, quorum: 'MORE_THAN_HALF' }, statutes: NO_STATUTES });

describe('ResolutionRuleForm', () => {
  it('starts a decision of the club own with a name to fill in and one task', () => {
    const form = new ResolutionRuleForm();
    expect(form.own).toBe(true);
    expect(form.errors.label).toBeDefined();
    form.label = '  Budget ';
    expect(form.valid).toBe(true);
    expect(form.toRule()).toMatchObject({ action: null, label: 'Budget', majority: null, enabled: true });
    expect(form.kinds().map((k) => k.value)).toEqual(['IMPLEMENT', 'UPLOAD_FILE', 'INVITE_MEETING', 'CREATE_APPOINTMENT']);
  });

  it('keeps a built-in decision nameless and offers its own automatic follow-up only', () => {
    const form = new ResolutionRuleForm(rule('HONORARY_GRANT', { majority: 'TWO_THIRDS' }));
    expect(form.own).toBe(false);
    expect(form.majority).toBe('TWO_THIRDS');
    const kinds = form.kinds().map((k) => k.value);
    expect(kinds).toContain('ENTER_HONORARY');
    expect(kinds).not.toContain('ENTER_OFFICE');
    form.majority = 'FREE';
    expect(form.toRule()).toMatchObject({ action: 'HONORARY_GRANT', label: null, majority: null });
  });

  it('checks the follow-up titles and due days', () => {
    const form = new ResolutionRuleForm(rule('GENERAL'));
    form.put(null, form.newFollowUp(' '));
    expect(form.errors.followUps).toContain('Titel');
    form.followUps[0].title = 'Umsetzen';
    form.followUps[0].dueDays = 400;
    expect(form.errors.followUps).toContain('365');
    form.followUps[0].dueDays = null;
    expect(form.valid).toBe(true);
  });
});

describe('follow-up workflow', () => {
  it('keeps the first follow-up starting with the decision', () => {
    const form = new ResolutionRuleForm(rule('GENERAL'));
    form.put(null, { ...form.newFollowUp('A'), afterPrevious: false });
    form.put(null, { ...form.newFollowUp('B'), afterPrevious: true });
    form.reorder(['1', '0']);
    expect(form.followUps.map((f) => [f.title, f.afterPrevious])).toEqual([
      ['B', false],
      ['A', false],
    ]);
    const removed = form.remove(0);
    form.restore(0, removed);
    expect(form.followUps[0].title).toBe('B');
  });

  it('checks who does it and the checklist', () => {
    const form = new ResolutionRuleForm(rule('GENERAL'));
    form.put(null, { ...form.newFollowUp('A'), assignTo: 'OFFICE' });
    expect(form.errors.followUps).toContain('Funktion');
    form.followUps[0] = { ...form.followUps[0], office: 'TREASURER' };
    expect(form.valid).toBe(true);
    form.followUps[0] = { ...form.followUps[0], assignTo: 'MEMBER' };
    expect(form.errors.followUps).toContain('Mitglied');
    expect(new ResolutionRuleForm(rule('ELECTION')).namesMember).toBe(true);
    form.followUps[0] = { ...form.followUps[0], assignTo: 'BOARD', checklist: Array.from({ length: 21 }, () => 'x') };
    expect(form.errors.followUps).toContain('20');
    form.followUps[0] = { ...form.followUps[0], checklist: [' a ', ''] };
    expect(form.toRule().followUps.at(-1)!.checklist).toEqual(['a']);
  });
});

describe('withRule', () => {
  it('replaces only the rule with the same key and appends a new one', () => {
    const before = rules(rule('GENERAL'), rule('ELECTION'));
    const changed = withRule(before, rule('ELECTION', { majority: 'SIMPLE' }));
    expect(changed.items.map((r) => r.majority)).toEqual([null, 'SIMPLE']);
    expect(withRule(before, rule(null as unknown as string, { label: 'Budget', action: null })).items).toHaveLength(3);
  });

  it('finds the key the server gave a new decision', () => {
    const before = rules(rule('GENERAL'));
    expect(createdAction(before, rules(rule('GENERAL'), rule('DECISION_X', { label: 'Budget' })))).toBe('DECISION_X');
    expect(createdAction(before, before)).toBeNull();
  });
});
