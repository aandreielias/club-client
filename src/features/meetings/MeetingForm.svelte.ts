import { FormState } from '../../lib/state/FormState.svelte';
import { ZonedClock, type LocalDateTime } from '../../lib/time/ZonedClock';
import type { MeetingType, NewMeeting } from './model';

export type MeetingField = 'title' | 'agenda' | 'urgency' | 'start' | 'end' | 'videoUrl';
type Errors = Partial<Record<MeetingField, string>>;

/** A new meeting: type, title (follows the type until typed), time in the club zone, place or video link, agenda. */
export class MeetingForm extends FormState<Errors> {
  type = $state.raw<MeetingType | null>(null);
  title = $state('');
  agenda = $state('');
  urgency = $state('');
  start = $state<LocalDateTime>('');
  end = $state<LocalDateTime>('');
  location = $state('');
  videoUrl = $state('');

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
      agenda: this.agenda.trim() || null,
      urgency: this.type?.needsReason ? this.urgency.trim() || null : null,
      startsAt: this.startsAt,
      endsAt: this.clock.toInstant(this.end),
      location: this.location.trim() || null,
      videoUrl: this.videoUrl.trim() || null,
    };
  }

  /** server: Meeting record */
  protected validate(): Errors {
    const errors: Errors = {};
    const title = this.title.trim();
    if (!title || title.length > 120) errors.title = '1 bis 120 Zeichen.';
    if (this.agenda.trim().length > 4000) errors.agenda = 'Höchstens 4000 Zeichen.';
    if (this.type?.needsReason && !this.urgency.trim()) errors.urgency = 'Grund der Dringlichkeit angeben.';
    if (!this.start) errors.start = 'Beginn angeben.';
    if (!this.end || this.end <= this.start) errors.end = 'Das Ende liegt nach dem Beginn.';
    const video = this.videoUrl.trim();
    if (video && !video.startsWith('https://')) errors.videoUrl = 'Link mit https:// angeben.';
    return errors;
  }
}
