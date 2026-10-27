import { FormState } from '../../lib/state/FormState.svelte';
import type { OfficeKind } from '../members/MembersApi';
import { ACTION_LABELS, isDayOfYear, MAJORITY_LABELS, type ActionRule, type Majority, type MeetingStep, type MeetingType, type MeetingTypeInput, type Quorum, type ResolutionAction, type StepAnchor } from './model';

export type MeetingTypeField = 'label' | 'invitationLabel' | 'notice' | 'grace' | 'majorities' | 'conveners' | 'actions' | 'dueBy' | 'steps';
type Errors = Partial<Record<MeetingTypeField, string>>;

export type NoticeUnit = 'hours' | 'days';

/** Editing a meeting type (server: MeetingType record); a new one starts like an ordinary board meeting. */
export class MeetingTypeForm extends FormState<Errors> {
  label = $state('');
  invitationLabel = $state('');
  electorate = $state<'BOARD' | 'ASSEMBLY'>('BOARD');
  notice = $state(14);
  noticeUnit = $state<NoticeUnit>('days');
  quorum = $state<Quorum>('MORE_THAN_HALF');
  grace = $state<number | null>(null);
  majorities = $state<Majority[]>(['SIMPLE']);
  conveners = $state<OfficeKind[]>(['CHAIR', 'VICE_CHAIR']);
  actions = $state<ResolutionAction[]>(['GENERAL']);
  needsReason = $state(false);
  yearly = $state(false);
  /** Day (1-31) and month (1-12) the yearly meeting should be planned by. */
  dueDay = $state(1);
  dueMonth = $state(10);
  sort = $state(10);
  archived = $state(false);
  /** What happens around each meeting; a new type starts with the server's two reminders. */
  steps = $state<MeetingStep[]>([
    { id: null, anchor: 'BEFORE_INVITE', offsetHours: 72, action: 'NOTIFICATION', audience: 'BOARD', title: null, body: null, system: 'INVITE_REMINDER' },
    { id: null, anchor: 'BEFORE_START', offsetHours: 24, action: 'NOTIFICATION', audience: 'ELECTORATE', title: null, body: null, system: 'START_REMINDER' },
  ]);

  constructor(
    type: MeetingType | null = null,
    /** The club's resolution rules: a decision with a fixed majority needs the type to offer it. */
    private readonly rules: readonly ActionRule[] = [],
  ) {
    super();
    if (!type) return;
    this.label = type.label;
    this.invitationLabel = type.invitationLabel;
    this.electorate = type.electorate;
    this.noticeUnit = type.noticeHours % 24 === 0 ? 'days' : 'hours';
    this.notice = this.noticeUnit === 'days' ? type.noticeHours / 24 : type.noticeHours;
    this.quorum = type.quorum;
    this.grace = type.graceMinutes;
    this.majorities = [...type.majorities];
    this.conveners = [...type.conveners];
    this.actions = [...type.actions];
    this.needsReason = type.needsReason;
    this.yearly = !!type.dueBy;
    if (type.dueBy) [this.dueMonth, this.dueDay] = type.dueBy.split('-').map(Number);
    this.sort = type.sort;
    this.archived = type.archived;
    this.steps = type.steps.map((s) => ({ ...s }));
  }

  /** From the timeline: whole days stay in days. */
  setNoticeHours(hours: number): void {
    this.noticeUnit = hours % 24 === 0 ? 'days' : 'hours';
    this.notice = this.noticeUnit === 'days' ? hours / 24 : hours;
  }

  /** A new task on that side; returns its index. */
  addStep(anchor: StepAnchor): number {
    const offsetHours = anchor === 'AFTER_END' ? 168 : 72;
    this.steps.push({ id: null, anchor, offsetHours, action: 'TASK', audience: 'BOARD', title: anchor === 'AFTER_END' ? 'Nachbereiten: {titel}' : 'Vorbereiten: {titel}',
      body: null, system: null });
    return this.steps.length - 1;
  }

  removeStep(index: number): void {
    this.steps.splice(index, 1);
  }

  get noticeHours(): number {
    return this.noticeUnit === 'days' ? this.notice * 24 : this.notice;
  }

  toInput(): MeetingTypeInput {
    return {
      label: this.label.trim(),
      invitationLabel: this.invitationLabel.trim(),
      electorate: this.electorate,
      noticeHours: this.noticeHours,
      quorum: this.quorum,
      graceMinutes: this.grace || null,
      majorities: this.majorities,
      conveners: this.conveners,
      actions: this.actions,
      needsReason: this.needsReason,
      dueBy: this.yearly ? `${String(this.dueMonth).padStart(2, '0')}-${String(this.dueDay).padStart(2, '0')}` : null,
      sort: this.sort,
      archived: this.archived,
      steps: this.steps.map((s) => (s.system ? { ...s, title: null, body: null } : { ...s, title: s.title?.trim() ?? '', body: s.body?.trim() || null })),
    };
  }

  /** server: MeetingType record */
  protected validate(): Errors {
    const errors: Errors = {};
    const label = this.label.trim();
    if (!label || label.length > 80) errors.label = '1 bis 80 Zeichen.';
    const invitation = this.invitationLabel.trim();
    if (!invitation || invitation.length > 120) errors.invitationLabel = '1 bis 120 Zeichen.';
    if (!Number.isInteger(this.notice) || this.notice < 0 || this.noticeHours > 8760) errors.notice = 'Ganze Zahl, höchstens ein Jahr.';
    if (this.grace != null && (!Number.isInteger(this.grace) || this.grace < 1 || this.grace > 1440)) errors.grace = '1 bis 1440 Minuten, oder leer.';
    if (!this.majorities.length) errors.majorities = 'Mindestens eine Mehrheit.';
    else {
      const missing = this.rules.find((r) => r.majority && this.actions.includes(r.action) && !this.majorities.includes(r.majority));
      if (missing) errors.majorities = `${ACTION_LABELS[missing.action]} braucht ${MAJORITY_LABELS[missing.majority!]}.`;
    }
    if (!this.conveners.length) errors.conveners = 'Mindestens eine Funktion.';
    if (!this.actions.includes('GENERAL')) errors.actions = 'Sonstige Beschlüsse sind immer möglich.';
    if (this.yearly && !isDayOfYear(this.dueMonth, this.dueDay)) {
      errors.dueBy = 'Diesen Tag gibt es nicht.';
    }
    if (this.steps.length > 30) errors.steps = 'Höchstens 30 Schritte.';
    else if (this.steps.some((s) => !s.system && (!s.title?.trim() || s.title.trim().length > 150 || (s.body?.length ?? 0) > 1000))) {
      errors.steps = 'Jeder Schritt braucht einen Titel (bis 150 Zeichen, Text bis 1000).';
    }
    return errors;
  }
}
