import { FormState } from '../../lib/state/FormState.svelte';
import type { OfficeKind } from '../members/MembersApi';
import { isDayOfYear, type Majority, type MeetingType, type MeetingTypeInput, type Quorum, type ResolutionAction } from './model';

export type MeetingTypeField = 'label' | 'invitationLabel' | 'notice' | 'grace' | 'majorities' | 'conveners' | 'actions' | 'dueBy';
type Errors = Partial<Record<MeetingTypeField, string>>;

export type NoticeUnit = 'hours' | 'days';

/** Editing a meeting type (server: MeetingType record); a new one starts like an ordinary board meeting. */
export class MeetingTypeForm extends FormState<Errors> {
  label = $state('');
  invitationLabel = $state('');
  statuteRef = $state('');
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

  constructor(type: MeetingType | null = null) {
    super();
    if (!type) return;
    this.label = type.label;
    this.invitationLabel = type.invitationLabel;
    this.statuteRef = type.statuteRef ?? '';
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
  }

  get noticeHours(): number {
    return this.noticeUnit === 'days' ? this.notice * 24 : this.notice;
  }

  toggle<T>(list: T[], value: T, on: boolean): T[] {
    return on ? [...new Set([...list, value])] : list.filter((v) => v !== value);
  }

  toInput(): MeetingTypeInput {
    return {
      label: this.label.trim(),
      invitationLabel: this.invitationLabel.trim(),
      statuteRef: this.statuteRef.trim() || null,
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
    else if ((this.actions.includes('STATUTES_CHANGE') && !this.majorities.includes('TWO_THIRDS'))
      || (this.actions.includes('DISSOLUTION') && !this.majorities.includes('THREE_QUARTERS'))) {
      errors.majorities = 'Statutenänderung braucht zwei Drittel, Auflösung drei Viertel.';
    }
    if (!this.conveners.length) errors.conveners = 'Mindestens eine Funktion.';
    if (!this.actions.includes('GENERAL')) errors.actions = 'Sonstige Beschlüsse sind immer möglich.';
    if (this.yearly && !isDayOfYear(this.dueMonth, this.dueDay)) {
      errors.dueBy = 'Diesen Tag gibt es nicht.';
    }
    return errors;
  }
}
