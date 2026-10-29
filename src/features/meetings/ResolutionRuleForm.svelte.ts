import { FormState } from '../../lib/state/FormState.svelte';
import {
  FOLLOW_UP_KIND_LABELS,
  isOwnAction,
  OWN_ACTION,
  type ActionRule,
  type FollowUpRule,
  type Majority,
  type ResolutionAction,
  type ResolutionRules,
} from './model';

export type RuleMajority = Majority | 'FREE';
type Errors = Partial<Record<'label' | 'followUps', string>>;

/** server: ActionRules — names of the club's own decisions, follow-ups per decision. */
export const RULE_LIMITS = { label: 60, title: 150, dueDays: 365, followUps: 10 } as const;

/** Editing one decision of the resolution rules; `null` starts a decision of the club's own. */
export class ResolutionRuleForm extends FormState<Errors> {
  label = $state('');
  majority = $state<RuleMajority>('FREE');
  followUps = $state<FollowUpRule[]>([]);
  readonly action: ResolutionAction | null;
  readonly enabled: boolean;

  constructor(rule: ActionRule | null = null) {
    super();
    this.action = rule?.action ?? null;
    this.label = rule?.label ?? '';
    this.majority = rule?.majority ?? 'FREE';
    this.followUps = rule ? rule.followUps.map((f) => ({ ...f })) : [{ id: null, kind: 'IMPLEMENT', title: 'Umsetzen: {beschluss}', dueDays: 14 }];
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

  addFollowUp(title: string): void {
    this.followUps.push({ id: null, kind: 'IMPLEMENT', title, dueDays: 7 });
  }

  toRule(): ActionRule {
    return {
      action: this.action,
      label: this.own ? this.label.trim() : null,
      majority: this.majority === 'FREE' ? null : this.majority,
      enabled: this.enabled,
      followUps: this.followUps.map((f) => ({ ...f, title: f.title.trim() })),
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
    }
    return errors;
  }
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
