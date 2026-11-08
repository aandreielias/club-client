import { FormState } from '../../lib/state/FormState.svelte';
import type { OfficeKind } from '../members/MembersApi';
import {
  isDayOfYear,
  type Majority,
  type MeetingStep,
  type MeetingType,
  type MeetingTypeInput,
  type Quorum,
  type Invitees,
  type Voting,
  type StepAnchor,
} from './model';

export type MeetingTypeField =
  'label' | 'invitationLabel' | 'notice' | 'grace' | 'majorities' | 'conveners' | 'dueBy' | 'steps' | 'videoUrl' | 'invitees';
type Errors = Partial<Record<MeetingTypeField, string>>;

export type NoticeUnit = 'hours' | 'days';

/** Editing a meeting type (server: MeetingType record); a new one starts like an ordinary board meeting. */
export class MeetingTypeForm extends FormState<Errors> {
  label = $state('');
  invitationLabel = $state('');
  invitees = $state<Invitees>('BOARD');
  voting = $state<Voting>('ALL_INVITED');
  /** CHOSEN only: bounds for the people a meeting invites; empty means at least one, no maximum. */
  minInvitees = $state<number | null>(null);
  maxInvitees = $state<number | null>(null);
  notice = $state(14);
  noticeUnit = $state<NoticeUnit>('days');
  quorum = $state<Quorum>('MORE_THAN_HALF');
  grace = $state<number | null>(null);
  majorities = $state<Majority[]>(['SIMPLE']);
  conveners = $state<OfficeKind[]>(['CHAIR', 'VICE_CHAIR']);
  needsReason = $state(false);
  yearly = $state(false);
  /** Day (1-31) and month (1-12) the yearly meeting should be planned by. */
  dueDay = $state(1);
  dueMonth = $state(10);
  sort = $state(10);
  archived = $state(false);
  /** Online participation for every meeting of the type, with an optional standing link (e.g. the board's video room). */
  online = $state(false);
  selfCheckIn = $state(true);
  videoUrl = $state('');
  /** What happens around each meeting; a new type starts with the server's two reminders. */
  steps = $state<MeetingStep[]>([
    {
      id: null,
      anchor: 'BEFORE_INVITE',
      offsetHours: 72,
      action: 'NOTIFICATION',
      audience: 'BOARD',
      title: null,
      body: null,
      system: 'INVITE_REMINDER',
      office: null,
    },
    {
      id: null,
      anchor: 'BEFORE_START',
      offsetHours: 24,
      action: 'NOTIFICATION',
      audience: 'ELECTORATE',
      title: null,
      body: null,
      system: 'START_REMINDER',
      office: null,
    },
  ]);

  constructor(type: MeetingType | null = null) {
    super();
    if (!type) return;
    this.label = type.label;
    this.invitationLabel = type.invitationLabel;
    this.invitees = type.invitees;
    this.voting = type.voting;
    this.minInvitees = type.minInvitees ?? null;
    this.maxInvitees = type.maxInvitees ?? null;
    this.noticeUnit = type.noticeHours % 24 === 0 ? 'days' : 'hours';
    this.notice = this.noticeUnit === 'days' ? type.noticeHours / 24 : type.noticeHours;
    this.quorum = type.quorum;
    this.grace = type.graceMinutes;
    this.majorities = [...type.majorities];
    this.conveners = [...type.conveners];
    this.needsReason = type.needsReason;
    this.yearly = !!type.dueBy;
    if (type.dueBy) [this.dueMonth, this.dueDay] = type.dueBy.split('-').map(Number);
    this.sort = type.sort;
    this.archived = type.archived;
    this.online = type.online;
    this.selfCheckIn = type.selfCheckIn !== false;
    this.videoUrl = type.videoUrl ?? '';
    this.steps = type.steps.map((s) => ({ ...s }));
  }

  /** From the timeline: whole days stay in days. */
  setNoticeHours(hours: number): void {
    this.noticeUnit = hours % 24 === 0 ? 'days' : 'hours';
    this.notice = this.noticeUnit === 'days' ? hours / 24 : hours;
  }

  /** A new task on that side, not yet added (the step dialog adds it). */
  newStep(anchor: StepAnchor): MeetingStep {
    return {
      id: null,
      anchor,
      offsetHours: anchor === 'AFTER_END' || anchor === 'AFTER_CREATE' ? 168 : 72,
      action: 'TASK',
      audience: 'BOARD',
      title: anchor === 'AFTER_END' ? 'Nachbereiten: {titel}' : anchor === 'AFTER_CREATE' ? 'Frist: {titel}' : 'Vorbereiten: {titel}',
      body: null,
      system: null,
      office: null,
    };
  }

  get noticeHours(): number {
    return this.noticeUnit === 'days' ? this.notice * 24 : this.notice;
  }

  toInput(): MeetingTypeInput {
    return {
      label: this.label.trim(),
      invitationLabel: this.invitationLabel.trim(),
      invitees: this.invitees,
      voting: this.voting,
      minInvitees: this.invitees === 'CHOSEN' ? this.minInvitees || null : null,
      maxInvitees: this.invitees === 'CHOSEN' ? this.maxInvitees || null : null,
      noticeHours: this.noticeHours,
      quorum: this.quorum,
      graceMinutes: this.grace || null,
      majorities: this.majorities,
      conveners: this.conveners,
      needsReason: this.needsReason,
      dueBy: this.yearly ? `${String(this.dueMonth).padStart(2, '0')}-${String(this.dueDay).padStart(2, '0')}` : null,
      sort: this.sort,
      archived: this.archived,
      online: this.online,
      selfCheckIn: this.selfCheckIn,
      videoUrl: this.online ? this.videoUrl.trim() || null : null,
      steps: this.steps.map((s) =>
        s.system
          ? { ...s, title: null, body: null, office: null }
          : { ...s, title: s.title?.trim() ?? '', body: s.body?.trim() || null, office: s.audience === 'OFFICE' ? s.office : null },
      ),
    };
  }

  /** server: MeetingType record */
  protected validate(): Errors {
    const errors: Errors = {};
    const label = this.label.trim();
    if (!label || label.length > 80) errors.label = 'Bezeichnung mit 1 bis 80 Zeichen angeben.';
    const invitation = this.invitationLabel.trim();
    if (!invitation || invitation.length > 120) errors.invitationLabel = 'Text für die Einladung mit 1 bis 120 Zeichen angeben.';
    if (!Number.isInteger(this.notice) || this.notice < 0 || this.noticeHours > 8760) errors.notice = 'Ganze Zahl, höchstens ein Jahr.';
    if (this.grace != null && (!Number.isInteger(this.grace) || this.grace < 1 || this.grace > 1440)) errors.grace = '1 bis 1440 Minuten, oder leer.';
    const bound = (n: number | null) => n == null || (Number.isInteger(n) && n >= 1 && n <= 50);
    if (
      this.invitees === 'CHOSEN' &&
      (!bound(this.minInvitees) || !bound(this.maxInvitees) || (this.minInvitees && this.maxInvitees && this.minInvitees > this.maxInvitees))
    )
      errors.invitees = '1 bis 50 Personen, die Mindestzahl nicht über der Höchstzahl.';
    if (!this.majorities.length) errors.majorities = 'Mindestens eine Mehrheit.';
    if (!this.conveners.length) errors.conveners = 'Mindestens eine Funktion.';
    if (this.yearly && !isDayOfYear(this.dueMonth, this.dueDay)) {
      errors.dueBy = 'Diesen Tag gibt es nicht.';
    }
    const video = this.videoUrl.trim();
    if (this.online && video && (!video.startsWith('https://') || video.length > 500)) errors.videoUrl = 'Link mit https:// angeben.';
    if (this.steps.length > 30) errors.steps = 'Höchstens 30 Schritte.';
    else if (this.steps.some((s) => !s.system && (!s.title?.trim() || s.title.trim().length > 150 || (s.body?.length ?? 0) > 1000))) {
      errors.steps = 'Jeder Schritt braucht einen Titel (bis 150 Zeichen, Text bis 1000).';
    } else if (this.steps.some((s) => s.audience === 'OFFICE' && !s.office)) errors.steps = 'Schritte an ein Amt brauchen das Amt.';
    return errors;
  }
}
