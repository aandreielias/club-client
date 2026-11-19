import { FormState } from '../../lib/state/FormState.svelte';
import { settings } from '../../settings';
import { ZonedClock, type LocalDate, type LocalDateTime } from '../../lib/time/ZonedClock';
import { repeatAt } from '../../lib/time/repeat';
import {
  SEEDED_APPOINTMENT_TYPES,
  type Appointment,
  type AppointmentPatch,
  type AppointmentType,
  type AppointmentTypeInfo,
  type NewAppointment,
} from './model';

export type FormField = 'title' | 'team' | 'start' | 'end' | 'description' | 'location' | 'cabins' | 'repeatUntil' | 'interval';

export type FormErrors = Partial<Record<FormField, string>>;

/** Select value for "club-wide" (no team). */
export const CLUB_WIDE = '';

/** The club's types (AppointmentTypesStore; default: the seeded ones). */
export interface TypeOffers {
  readonly items: readonly AppointmentTypeInfo[];
  get(type: AppointmentType): AppointmentTypeInfo | undefined;
}

const SEEDED_OFFERS: TypeOffers = {
  items: SEEDED_APPOINTMENT_TYPES,
  get: (type) => SEEDED_APPOINTMENT_TYPES.find((t) => t.key === type),
};

const limits = settings.calendar;

/**
 * Editable state of a new or existing appointment. Times are club-local wall-clock values;
 * conversion to UTC instants happens only in `toNew` / `toPatch`. Validation mirrors the server so
 * most mistakes show before a request.
 */
export class AppointmentForm extends FormState<FormErrors> {
  #type = $state<AppointmentType>('TRAINING');
  teamId = $state<string>(CLUB_WIDE);
  title = $state('');
  description = $state('');
  location = $state('');
  /** A place of the locations module; '' = free text in `location`. */
  locationId = $state('');
  /** One per club cabin label, by position. */
  cabins = $state<string[]>([]);
  start = $state<LocalDateTime>('');
  end = $state<LocalDateTime>('');
  repeat = $state(false);
  repeatUntil = $state<LocalDate>('');
  /** Steps of `unit` between occurrences. */
  interval = $state(1);
  unit = $state<'weeks' | 'months' | 'weekday'>('weeks');
  /** Car pools for this appointment; null follows the type until switched. */
  rides = $state<boolean | null>(null);
  /** Editing one occurrence of a series: the later ones change alike. */
  includeFollowing = $state(false);

  private constructor(
    private readonly clock: ZonedClock,
    readonly original: Appointment | null,
    private readonly types: TypeOffers,
  ) {
    super();
  }

  get isEdit(): boolean {
    return this.original !== null;
  }

  /** Empty form for a new appointment on `date` (default today): the club's first type at its default time. */
  static blank(clock: ZonedClock, teamId: string | null, date: LocalDate = clock.today(), types: TypeOffers = SEEDED_OFFERS): AppointmentForm {
    const form = new AppointmentForm(clock, null, types);
    form.teamId = teamId ?? CLUB_WIDE;
    form.#type = types.items.find((t) => !t.archived)?.key ?? form.#type;
    const info = form.info;
    form.start = `${date}T${info?.defaultStart ?? limits.defaultStartTime}`;
    form.end = ZonedClock.addMinutes(form.start, info?.defaultMinutes ?? limits.defaultDurationMinutes);
    return form;
  }

  static edit(clock: ZonedClock, appointment: Appointment, types: TypeOffers = SEEDED_OFFERS): AppointmentForm {
    const form = new AppointmentForm(clock, appointment, types);
    form.rides = appointment.rides;
    form.#type = appointment.type;
    form.teamId = appointment.teamId ?? CLUB_WIDE;
    form.title = appointment.title;
    form.description = appointment.description ?? '';
    form.location = appointment.location ?? '';
    form.locationId = appointment.locationId ?? '';
    form.cabins = [...appointment.cabins];
    form.start = clock.toLocal(appointment.startsAt);
    form.end = clock.toLocal(appointment.endsAt);
    return form;
  }

  get type(): AppointmentType {
    return this.#type;
  }

  /** A new appointment still at the old type's default time takes the new type's. */
  set type(type: AppointmentType) {
    const before = this.info;
    this.#type = type;
    const after = this.info;
    if (this.isEdit || !before || !after || !this.start) return;
    if (this.start.slice(11) === before.defaultStart && this.durationMinutes() === before.defaultMinutes) {
      this.start = `${this.start.slice(0, 10)}T${after.defaultStart}`;
      this.end = ZonedClock.addMinutes(this.start, after.defaultMinutes);
    }
  }

  private get info(): AppointmentTypeInfo | undefined {
    return this.types.get(this.#type);
  }

  /** Moves the start and keeps the duration. */
  setStart(start: LocalDateTime): void {
    const duration = this.durationMinutes();
    this.start = start;
    if (start && duration !== null && duration > 0) this.end = ZonedClock.addMinutes(start, duration);
  }

  /** Cabins only for types that have them; switching to a type without drops them. */
  get cabinsShown(): boolean {
    return this.info?.cabins ?? false;
  }

  /** Car pools as they will be saved: switched here, else what the type offers. */
  get ridesOn(): boolean {
    return this.rides ?? this.info?.rides ?? false;
  }

  toNew(): NewAppointment {
    return {
      teamId: this.teamId === CLUB_WIDE ? null : this.teamId,
      type: this.type,
      title: this.title.trim(),
      description: this.description.trim() || null,
      location: this.locationId ? null : this.location.trim() || null,
      locationId: this.locationId || null,
      cabins: this.cabinsShown ? AppointmentForm.trimmed(this.cabins) : [],
      startsAt: this.clock.toInstant(this.start),
      endsAt: this.clock.toInstant(this.end),
      repeatUntil: this.repeat ? this.repeatUntil : null,
      intervalWeeks: this.repeat && this.unit === 'weeks' ? this.interval : null,
      intervalMonths: this.repeat && this.unit !== 'weeks' ? this.interval : null,
      byWeekday: this.repeat && this.unit === 'weekday',
      rides: this.ridesOn,
    };
  }

  /** Only changed fields; an emptied description/location is sent as '' to clear it. */
  toPatch(): AppointmentPatch {
    const original = this.original;
    if (!original) throw new Error('toPatch() needs an existing appointment');
    const next = this.toNew();
    const patch: AppointmentPatch = {};
    if (next.type !== original.type) patch.type = next.type;
    if (next.title !== original.title) patch.title = next.title;
    if ((next.description ?? '') !== (original.description ?? '')) patch.description = next.description ?? '';
    if (next.locationId !== original.locationId) {
      if (next.locationId) patch.locationId = next.locationId;
      else {
        patch.clearLocationId = true;
        patch.location = next.location ?? '';
      }
    } else if (!next.locationId && (next.location ?? '') !== (original.location ?? '')) patch.location = next.location ?? '';
    if (next.cabins.join('\n') !== original.cabins.join('\n')) patch.cabins = next.cabins;
    if (next.startsAt !== original.startsAt) patch.startsAt = next.startsAt;
    if (next.endsAt !== original.endsAt) patch.endsAt = next.endsAt;
    if (next.rides !== original.rides) patch.rides = next.rides;
    if (this.includeFollowing && original.seriesId && Object.keys(patch).length) patch.includeFollowing = true;
    return patch;
  }

  /** server: Appointment.cabins — values trimmed, trailing empty ones dropped. */
  private static trimmed(cabins: string[]): string[] {
    const out = cabins.map((c) => (c ?? '').trim());
    while (out.length && !out[out.length - 1]) out.pop();
    return out;
  }

  /** Number of occurrences the series would create (1 without repetition). */
  occurrences(): number {
    if (!this.repeat || !this.repeatUntil || !this.start) return 1;
    const rhythm =
      this.unit === 'weeks'
        ? { weeks: this.interval, months: 0, byWeekday: false }
        : { weeks: 0, months: this.interval, byWeekday: this.unit === 'weekday' };
    let n = 0;
    while (n <= limits.maxSeriesOccurrences && repeatAt(this.start, rhythm, n).slice(0, 10) <= this.repeatUntil) n++;
    return n;
  }

  private durationMinutes(): number | null {
    if (!this.start || !this.end) return null;
    return (Date.parse(`${this.end}Z`) - Date.parse(`${this.start}Z`)) / 60_000;
  }

  protected validate(): FormErrors {
    const errors: FormErrors = {};
    const title = this.title.trim();
    if (!title || title.length > limits.titleMaxLength) errors.title = `Titel mit 1 bis ${limits.titleMaxLength} Zeichen angeben.`;
    if (this.description.length > limits.descriptionMaxLength) {
      errors.description = `Höchstens ${limits.descriptionMaxLength} Zeichen.`;
    }
    if (this.location.length > limits.locationMaxLength) errors.location = `Höchstens ${limits.locationMaxLength} Zeichen.`;
    if (this.cabins.some((c) => (c ?? '').trim().length > limits.cabinMaxLength)) {
      errors.cabins = `Höchstens ${limits.cabinMaxLength} Zeichen.`;
    }
    if (!this.start) errors.start = 'Beginn angeben.';
    const duration = this.durationMinutes();
    if (!this.end) errors.end = 'Ende angeben.';
    else if (duration !== null && duration <= 0) errors.end = 'Das Ende muss nach dem Beginn liegen.';
    else {
      const maxDays = this.info?.maxDays ?? limits.maxDurationDays;
      if (duration !== null && duration > maxDays * 24 * 60) errors.end = `Ein Termin dauert höchstens ${maxDays} ${maxDays === 1 ? 'Tag' : 'Tage'}.`;
    }
    if (this.repeat && !this.isEdit) this.validateSeries(errors);
    return errors;
  }

  private validateSeries(errors: FormErrors): void {
    const max = this.unit === 'weeks' ? limits.maxIntervalWeeks : limits.maxIntervalMonths;
    if (!Number.isInteger(this.interval) || this.interval < 1 || this.interval > max) {
      errors.interval = `1 bis ${max} ${this.unit === 'weeks' ? 'Wochen' : 'Monate'}.`;
      return;
    }
    if (!this.repeatUntil || (this.start && this.repeatUntil < this.start.slice(0, 10))) {
      errors.repeatUntil = 'Datum am oder nach dem ersten Termin angeben.';
    } else if (this.occurrences() > limits.maxSeriesOccurrences) {
      errors.repeatUntil = `Höchstens ${limits.maxSeriesOccurrences} Termine pro Serie.`;
    }
  }
}
