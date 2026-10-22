import { FormState } from '../../lib/state/FormState.svelte';
import { ZonedClock, type LocalDateTime } from '../../lib/time/ZonedClock';
import { KIND_LABELS, type MeetingKind, type NewMeeting } from './model';

export type MeetingField = 'title' | 'agenda' | 'urgency' | 'start' | 'end' | 'videoUrl';
type Errors = Partial<Record<MeetingField, string>>;

/** A new meeting: kind, title (follows the kind until typed), time in the club zone, place or video link, agenda. */
export class MeetingForm extends FormState<Errors> {
  kind = $state<MeetingKind>('ASSEMBLY');
  title = $state(KIND_LABELS.ASSEMBLY);
  agenda = $state('');
  urgency = $state('');
  start = $state<LocalDateTime>('');
  end = $state<LocalDateTime>('');
  location = $state('');
  videoUrl = $state('');

  constructor(
    private readonly clock: ZonedClock,
    start: LocalDateTime,
  ) {
    super();
    this.start = start;
    this.end = ZonedClock.addMinutes(start, 120);
  }

  /** Changing the kind renames the meeting while the title is still a kind's name. */
  setKind(kind: MeetingKind): void {
    if (Object.values(KIND_LABELS).includes(this.title.trim())) this.title = KIND_LABELS[kind];
    this.kind = kind;
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
      kind: this.kind,
      title: this.title.trim(),
      agenda: this.agenda.trim() || null,
      urgency: this.kind === 'EXTRA_BOARD' ? this.urgency.trim() || null : null,
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
    if (this.kind === 'EXTRA_BOARD' && !this.urgency.trim()) errors.urgency = 'Grund der Dringlichkeit angeben (§ 10 Abs. 3).';
    if (!this.start) errors.start = 'Beginn angeben.';
    if (!this.end || this.end <= this.start) errors.end = 'Das Ende liegt nach dem Beginn.';
    const video = this.videoUrl.trim();
    if (video && !video.startsWith('https://')) errors.videoUrl = 'Link mit https:// angeben.';
    return errors;
  }
}
