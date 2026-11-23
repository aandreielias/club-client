import { FormState } from '../../lib/state/FormState.svelte';
import { ZonedClock, type LocalDateTime } from '../../lib/time/ZonedClock';
import { agendaError, toInputs, type AgendaRow } from './agenda';
import type { Meeting, MeetingPatch, MeetingType, NewMeeting } from './model';

type MeetingField = 'title' | 'items' | 'urgency' | 'start' | 'end';
type Errors = Partial<Record<MeetingField, string>>;

/** Place of an existing meeting (changeable until it closes); online kinds have their call in the app. */
export class MeetingPlaceForm extends FormState<Errors> {
  location = $state('');

  static of(meeting: { location: string | null }): MeetingPlaceForm {
    const form = new MeetingPlaceForm();
    form.location = meeting.location ?? '';
    return form;
  }

  toPatch(): { location: string } {
    return { location: this.location.trim() };
  }

  protected validate(): Errors {
    return {};
  }
}

/** A new meeting: type, title (follows the type until typed), time in the club zone, place, the Tagesordnung with its Beschlüsse. */
export class MeetingForm extends FormState<Errors> {
  type = $state.raw<MeetingType | null>(null);
  title = $state('');
  rows = $state<AgendaRow[]>([]);
  urgency = $state('');
  start = $state<LocalDateTime>('');
  end = $state<LocalDateTime>('');
  location = $state('');

  constructor(
    private readonly clock: ZonedClock,
    start: LocalDateTime,
    /** Labels of every type: a title that is one of them follows the type. */
    private readonly labels: readonly string[] = [],
  ) {
    super();
    this.start = start;
    this.end = ZonedClock.addMinutes(start, 120);
  }

  /** A draft to edit: its type, title, urgency and times. */
  static of(meeting: Meeting, type: MeetingType | null, clock: ZonedClock): MeetingForm {
    const form = new MeetingForm(clock, clock.toLocal(new Date(meeting.startsAt)));
    form.type = type;
    form.title = meeting.title;
    form.urgency = meeting.urgency ?? '';
    form.end = clock.toLocal(new Date(meeting.endsAt));
    form.location = meeting.location ?? '';
    return form;
  }

  /** The draft's own fields (place and link have their own editor; the agenda its items). */
  toPatch(): MeetingPatch {
    return {
      title: this.title.trim(),
      urgency: this.type?.needsReason ? this.urgency.trim() : '',
      startsAt: this.startsAt,
      endsAt: this.clock.toInstant(this.end),
    };
  }

  /** Changing the type renames the meeting while the title is empty or still a type's name. */
  setType(type: MeetingType): void {
    if (!this.title.trim() || this.labels.includes(this.title.trim())) this.title = type.label;
    this.type = type;
  }

  /** Moving the start keeps the duration. */
  setStart(start: LocalDateTime): void {
    const minutes = (Date.parse(this.end) - Date.parse(this.start)) / 60_000;
    this.start = start;
    if (start && minutes > 0) this.end = ZonedClock.addMinutes(start, minutes);
  }

  get startsAt(): string {
    return this.clock.toInstant(this.start);
  }

  toNew(): NewMeeting {
    return {
      kind: this.type!.key,
      title: this.title.trim(),
      items: toInputs(this.rows),
      urgency: this.type?.needsReason ? this.urgency.trim() || null : null,
      startsAt: this.startsAt,
      endsAt: this.clock.toInstant(this.end),
      location: this.location.trim() || null,
    };
  }

  /** server: Meeting record */
  protected validate(): Errors {
    const errors: Errors = {};
    const title = this.title.trim();
    if (!title || title.length > 120) errors.title = 'Titel mit 1 bis 120 Zeichen angeben.';
    const agenda = agendaError(this.rows);
    if (agenda) errors.items = agenda;
    if (this.type?.needsReason && !this.urgency.trim()) errors.urgency = 'Grund der Dringlichkeit angeben.';
    if (!this.start) errors.start = 'Beginn angeben.';
    if (!this.end || this.end <= this.start) errors.end = 'Das Ende liegt nach dem Beginn.';
    return errors;
  }
}
