import { FormState } from '../../lib/state/FormState.svelte';
import { settings } from '../../settings';
import { ZonedClock, type LocalDate, type LocalDateTime } from '../../lib/time/ZonedClock';
import { SEEDED_APPOINTMENT_TYPES, type Appointment, type AppointmentPatch, type AppointmentType, type NewAppointment } from './model';

export type FormField = 'title' | 'team' | 'start' | 'end' | 'description' | 'location' | 'cabins' | 'repeatUntil' | 'intervalWeeks';

export type FormErrors = Partial<Record<FormField, string>>;

/** Select value for "club-wide" (no team). */
export const CLUB_WIDE = '';

/** What a type offers (the club's types: AppointmentTypesStore; default: the seeded ones). */
export interface TypeOffers {
  cabins(type: AppointmentType): boolean;
  rides(type: AppointmentType): boolean;
}

const SEEDED_OFFERS: TypeOffers = {
  cabins: (type) => SEEDED_APPOINTMENT_TYPES.some((t) => t.key === type && t.cabins),
  rides: (type) => SEEDED_APPOINTMENT_TYPES.some((t) => t.key === type && t.rides),
};

const limits = settings.calendar;

/**
 * Editable state of a new or existing appointment. Times are club-local wall-clock values;
 * conversion to UTC instants happens only in `toNew` / `toPatch`. Validation mirrors the server so
 * most mistakes show before a request.
 */
export class AppointmentForm extends FormState<FormErrors> {
  type = $state<AppointmentType>('TRAINING');
  teamId = $state<string>(CLUB_WIDE);
  title = $state('');
  description = $state('');
  location = $state('');
  /** A place of the locations module; '' = free text in `location`. */
  locationId = $state('');
  cabinMen = $state('');
  cabinWomen = $state('');
  start = $state<LocalDateTime>('');
  end = $state<LocalDateTime>('');
  repeat = $state(false);
  repeatUntil = $state<LocalDate>('');
  intervalWeeks = $state(1);
  /** Car pools for this appointment; null follows the type until switched. */
  rides = $state<boolean | null>(null);

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

  /** Empty form for a new appointment on `date` (default today) at the default time. */
  static blank(clock: ZonedClock, teamId: string | null, date: LocalDate = clock.today(), types: TypeOffers = SEEDED_OFFERS): AppointmentForm {
    const form = new AppointmentForm(clock, null, types);
    form.teamId = teamId ?? CLUB_WIDE;
    form.start = `${date}T${limits.defaultStartTime}`;
    form.end = ZonedClock.addMinutes(form.start, limits.defaultDurationMinutes);
    return form;
  }

  static edit(clock: ZonedClock, appointment: Appointment, types: TypeOffers = SEEDED_OFFERS): AppointmentForm {
    const form = new AppointmentForm(clock, appointment, types);
    form.rides = appointment.rides;
    form.type = appointment.type;
    form.teamId = appointment.teamId ?? CLUB_WIDE;
    form.title = appointment.title;
    form.description = appointment.description ?? '';
    form.location = appointment.location ?? '';
    form.locationId = appointment.locationId ?? '';
    form.cabinMen = appointment.cabinMen ?? '';
    form.cabinWomen = appointment.cabinWomen ?? '';
    form.start = clock.toLocal(appointment.startsAt);
    form.end = clock.toLocal(appointment.endsAt);
    return form;
  }

  /** Moves the start and keeps the duration. */
  setStart(start: LocalDateTime): void {
    const duration = this.durationMinutes();
    this.start = start;
    if (start && duration !== null && duration > 0) this.end = ZonedClock.addMinutes(start, duration);
  }

  /** Cabins only for types that have them; switching to a type without drops them. */
  get cabinsShown(): boolean {
    return this.types.cabins(this.type);
  }

  /** Car pools as they will be saved: switched here, else what the type offers. */
  get ridesOn(): boolean {
    return this.rides ?? this.types.rides(this.type);
  }

  toNew(): NewAppointment {
    return {
      teamId: this.teamId === CLUB_WIDE ? null : this.teamId,
      type: this.type,
      title: this.title.trim(),
      description: this.description.trim() || null,
      location: this.locationId ? null : this.location.trim() || null,
      locationId: this.locationId || null,
      cabinMen: (this.cabinsShown && this.cabinMen.trim()) || null,
      cabinWomen: (this.cabinsShown && this.cabinWomen.trim()) || null,
      startsAt: this.clock.toInstant(this.start),
      endsAt: this.clock.toInstant(this.end),
      repeatUntil: this.repeat ? this.repeatUntil : null,
      intervalWeeks: this.repeat ? this.intervalWeeks : null,
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
    if ((next.cabinMen ?? '') !== (original.cabinMen ?? '')) patch.cabinMen = next.cabinMen ?? '';
    if ((next.cabinWomen ?? '') !== (original.cabinWomen ?? '')) patch.cabinWomen = next.cabinWomen ?? '';
    if (next.startsAt !== original.startsAt) patch.startsAt = next.startsAt;
    if (next.endsAt !== original.endsAt) patch.endsAt = next.endsAt;
    if (next.rides !== original.rides) patch.rides = next.rides;
    return patch;
  }

  /** Number of occurrences the series would create (1 without repetition). */
  occurrences(): number {
    if (!this.repeat || !this.repeatUntil || !this.start) return 1;
    const days = (Date.parse(this.repeatUntil) - Date.parse(this.start.slice(0, 10))) / 86_400_000;
    return days < 0 ? 0 : Math.floor(days / (7 * this.intervalWeeks)) + 1;
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
    if (this.cabinMen.trim().length > limits.cabinMaxLength || this.cabinWomen.trim().length > limits.cabinMaxLength) {
      errors.cabins = `Höchstens ${limits.cabinMaxLength} Zeichen.`;
    }
    if (!this.start) errors.start = 'Beginn angeben.';
    const duration = this.durationMinutes();
    if (!this.end) errors.end = 'Ende angeben.';
    else if (duration !== null && duration <= 0) errors.end = 'Das Ende muss nach dem Beginn liegen.';
    else if (duration !== null && duration > limits.maxDurationDays * 24 * 60) {
      errors.end = `Ein Termin dauert höchstens ${limits.maxDurationDays} Tage.`;
    }
    if (this.repeat && !this.isEdit) this.validateSeries(errors);
    return errors;
  }

  private validateSeries(errors: FormErrors): void {
    if (!Number.isInteger(this.intervalWeeks) || this.intervalWeeks < 1 || this.intervalWeeks > limits.maxIntervalWeeks) {
      errors.intervalWeeks = `1 bis ${limits.maxIntervalWeeks} Wochen.`;
      return;
    }
    if (!this.repeatUntil || (this.start && this.repeatUntil < this.start.slice(0, 10))) {
      errors.repeatUntil = 'Datum am oder nach dem ersten Termin angeben.';
    } else if (this.occurrences() > limits.maxSeriesOccurrences) {
      errors.repeatUntil = `Höchstens ${limits.maxSeriesOccurrences} Termine pro Serie.`;
    }
  }
}
