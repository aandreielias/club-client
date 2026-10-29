import { FormState } from '../../lib/state/FormState.svelte';
import {
  FOLLOW_UP_KIND_LABELS,
  isOwnAction,
  NAMES_MEMBER,
  plainFollowUp,
  NO_STATUTES,
  OWN_ACTION,
  type ActionRule,
  type FollowUpRule,
  type Majority,
  type ResolutionAction,
  type ResolutionRules,
  type StatutesPlace,
} from './model';

export type RuleMajority = Majority | 'FREE';
type Errors = Partial<Record<'label' | 'followUps', string>>;

/** server: ActionRules — names of the club's own decisions, follow-ups per decision. */
export const RULE_LIMITS = { label: 60, title: 150, dueDays: 365, followUps: 10, description: 2000, checklist: 20, item: 200 } as const;

/** Editing one decision of the resolution rules; `null` starts a decision of the club's own. */
export class ResolutionRuleForm extends FormState<Errors> {
  label = $state('');
  majority = $state<RuleMajority>('FREE');
  followUps = $state<FollowUpRule[]>([]);
  readonly action: ResolutionAction | null;
  readonly enabled: boolean;
  /** Only for the statute change: where the new statutes go (a club-wide setting, saved with the rule). */
  statutes = $state<StatutesPlace | null>(null);

  constructor(rule: ActionRule | null = null, statutes: StatutesPlace | null = null) {
    super();
    if (rule?.action === 'STATUTES_CHANGE') this.statutes = { ...(statutes ?? NO_STATUTES) };
    this.action = rule?.action ?? null;
    this.label = rule?.label ?? '';
    this.majority = rule?.majority ?? 'FREE';
    this.followUps = rule
      ? rule.followUps.map((f) => ({ ...plainFollowUp(f.kind, f.title, f.dueDays), ...f, checklist: [...(f.checklist ?? [])] }))
      : [plainFollowUp('IMPLEMENT', 'Umsetzen: {beschluss}', 14)];
    this.enabled = rule?.enabled ?? true;
  }

  /** The club's own decisions carry a name; built-in ones have theirs from the app. */
  get own(): boolean {
    return !this.action || isOwnAction(this.action);
  }

  /** Follow-up kinds this decision may have: its own automatic one and those every decision may have; the club's own only IMPLEMENT. */
  kinds(): { value: FollowUpRule['kind']; label: string }[] {
    return (Object.keys(FOLLOW_UP_KIND_LABELS) as FollowUpRule['kind'][])
      .filter((k) => (this.own ? k === 'IMPLEMENT' : !OWN_ACTION[k] || OWN_ACTION[k] === this.action))
      .map((k) => ({ value: k, label: FOLLOW_UP_KIND_LABELS[k] }));
  }

  /** Follow-ups may go to the member the decision is about (honorary membership, election, exclusion). */
  get namesMember(): boolean {
    return !!this.action && NAMES_MEMBER.includes(this.action);
  }

  /** A new follow-up to fill in (the dialog adds it with `put`). */
  newFollowUp(title: string): FollowUpRule {
    return plainFollowUp('IMPLEMENT', title, 7);
  }

  /** Replaces the follow-up at `index`, or adds it at the end. */
  put(index: number | null, followUp: FollowUpRule): void {
    if (index == null) this.followUps.push(followUp);
    else this.followUps[index] = followUp;
    this.#firstStarts();
  }

  /** Takes one out; answers it, for undo. */
  remove(index: number): FollowUpRule {
    const [removed] = this.followUps.splice(index, 1);
    this.#firstStarts();
    return removed;
  }

  /** Puts a removed one back at its place. */
  restore(index: number, followUp: FollowUpRule): void {
    this.followUps.splice(Math.min(index, this.followUps.length), 0, followUp);
    this.#firstStarts();
  }

  /** New order from the list's keys (the old positions as text). */
  reorder(keys: readonly string[]): void {
    this.followUps = keys.map((k) => this.followUps[Number(k)]);
    this.#firstStarts();
  }

  /** The first follow-up has nothing to wait for. */
  #firstStarts(): void {
    if (this.followUps[0]?.afterPrevious) this.followUps[0] = { ...this.followUps[0], afterPrevious: false };
  }

  toRule(): ActionRule {
    return {
      action: this.action,
      label: this.own ? this.label.trim() : null,
      majority: this.majority === 'FREE' ? null : this.majority,
      enabled: this.enabled,
      followUps: this.followUps.map((f) => ({
        ...f,
        title: f.title.trim(),
        description: f.description?.trim() || null,
        checklist: f.checklist.map((t) => t.trim()).filter(Boolean),
        office: f.assignTo === 'OFFICE' ? f.office : null,
      })),
    };
  }

  protected validate(): Errors {
    const errors: Errors = {};
    const label = this.label.trim();
    if (this.own && (!label || label.length > RULE_LIMITS.label)) errors.label = `Name mit 1 bis ${RULE_LIMITS.label} Zeichen.`;
    if (this.followUps.length > RULE_LIMITS.followUps) errors.followUps = `Höchstens ${RULE_LIMITS.followUps} Folgeaufgaben.`;
    else if (this.followUps.some((f) => !f.title.trim() || f.title.trim().length > RULE_LIMITS.title)) {
      errors.followUps = `Jede Folgeaufgabe braucht einen Titel (bis ${RULE_LIMITS.title} Zeichen).`;
    } else if (this.followUps.some((f) => f.dueDays != null && (!Number.isInteger(f.dueDays) || f.dueDays < 0 || f.dueDays > RULE_LIMITS.dueDays))) {
      errors.followUps = 'Fällig nach 0 bis 365 Tagen, oder leer.';
    } else {
      const problem = this.followUps.map((f) => followUpProblem(f, this.namesMember)).find(Boolean);
      if (problem) errors.followUps = problem;
    }
    return errors;
  }
}

/** What is wrong with one follow-up's options (server: FollowUpPlanner.validate), or null. */
export function followUpProblem(f: FollowUpRule, namesMember: boolean): string | null {
  if (f.assignTo === 'OFFICE' && !f.office) return 'Eine Funktion wählen, die die Aufgabe übernimmt.';
  if (f.assignTo === 'MEMBER' && !namesMember) return 'Nur Beschlüsse über ein Mitglied können es beauftragen.';
  if ((f.description?.length ?? 0) > RULE_LIMITS.description) return `Beschreibung bis ${RULE_LIMITS.description} Zeichen.`;
  const items = f.checklist.map((t) => t.trim()).filter(Boolean);
  if (items.length > RULE_LIMITS.checklist || items.some((t) => t.length > RULE_LIMITS.item)) {
    return `Höchstens ${RULE_LIMITS.checklist} Punkte mit je bis ${RULE_LIMITS.item} Zeichen.`;
  }
  return null;
}

/** The whole rules with `rule` in place of the one with its key; a new one (no key yet) goes to the end. Others stay as they are. */
export function withRule(rules: ResolutionRules, rule: ActionRule): ResolutionRules {
  const index = rule.action ? rules.items.findIndex((r) => r.action === rule.action) : -1;
  const items = index < 0 ? [...rules.items, rule] : rules.items.map((r, i) => (i === index ? rule : r));
  return { ...rules, items };
}

/** The key the server gave a new decision of the club's own: the one that was not there before. */
export function createdAction(before: ResolutionRules, after: ResolutionRules): ResolutionAction | null {
  const known = new Set(before.items.map((r) => r.action));
  return after.items.find((r) => r.action && !known.has(r.action))?.action ?? null;
}
