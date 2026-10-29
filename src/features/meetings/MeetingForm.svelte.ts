import { FormState } from '../../lib/state/FormState.svelte';
import { ZonedClock, type LocalDateTime } from '../../lib/time/ZonedClock';
import type { MeetingType, NewMeeting } from './model';

export type MeetingField = 'title' | 'agenda' | 'urgency' | 'start' | 'end' | 'videoUrl';
type Errors = Partial<Record<MeetingField, string>>;

/** server: MeetingType.videoFor — a meeting of an online kind needs a https link, its own or the kind's standing one. */
export function videoError(online: boolean, videoUrl: string, standing: string | null = null): string | undefined {
  const video = videoUrl.trim();
  if (!online) return undefined;
  if (!video) return standing ? undefined : 'Link zur Videokonferenz angeben.';
  if (!video.startsWith('https://') || video.length > 500) return 'Link mit https:// angeben.';
  return undefined;
}

/** Place and video link of an existing meeting (changeable until it closes); online participation comes from its kind. */
export class MeetingPlaceForm extends FormState<Errors> {
  location = $state('');
  videoUrl = $state('');

  constructor(
    readonly online: boolean,
    readonly standing: string | null,
  ) {
    super();
  }

  static of(meeting: { location: string | null; online: boolean; videoUrl: string | null }, type: MeetingType | undefined): MeetingPlaceForm {
    const form = new MeetingPlaceForm(meeting.online, type?.videoUrl ?? null);
    form.location = meeting.location ?? '';
    form.videoUrl = meeting.videoUrl && meeting.videoUrl !== form.standing ? meeting.videoUrl : '';
    return form;
  }

  /** An empty link falls back to the kind's standing one. */
  toPatch(): { location: string; videoUrl: string } {
    return { location: this.location.trim(), videoUrl: this.online ? this.videoUrl.trim() : '' };
  }

  protected validate(): Errors {
    const errors: Errors = {};
    const video = videoError(this.online, this.videoUrl, this.standing);
    if (video) errors.videoUrl = video;
    return errors;
  }
}

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

  /** The kind lets members join online: the meeting shows a link. */
  get online(): boolean {
    return !!this.type?.online;
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
      videoUrl: this.online ? this.videoUrl.trim() || null : null,
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
    const video = videoError(this.online, this.videoUrl, this.type?.videoUrl ?? null);
    if (video) errors.videoUrl = video;
    return errors;
  }
}
