import { settings } from '../../settings';
import type { NewAbsence } from './model';

/** New absence: who (self or a minor), from–to (club-local dates, inclusive), optional reason. */
export class AbsenceForm {
  /** '' = oneself. */
  memberId = $state('');
  from = $state('');
  to = $state('');
  reason = $state('');
  submitted = $state(false);

  readonly error: string | null;

  constructor(today: string) {
    this.from = today;
    this.to = today;
    this.error = $derived(this.submitted ? this.validate() : null);
  }

  get valid(): boolean {
    return this.validate() === null;
  }

  toNew(): NewAbsence {
    return { memberId: this.memberId || null, from: this.from, to: this.to, reason: this.reason.trim() || null };
  }

  private validate(): string | null {
    if (!this.from || !this.to || this.to < this.from) return 'Das Ende darf nicht vor dem Beginn liegen.';
    if ((Date.parse(this.to) - Date.parse(this.from)) / 86_400_000 >= 366) return 'Höchstens ein Jahr.';
    if (this.reason.length > settings.calendar.reasonMaxLength) return `Grund mit höchstens ${settings.calendar.reasonMaxLength} Zeichen.`;
    return null;
  }
}
