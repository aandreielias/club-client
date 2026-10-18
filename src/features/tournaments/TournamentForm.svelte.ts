import type { NewTournament } from './model';

export type TournamentField = 'name' | 'dates' | 'groups';

/** A new tournament: name, days, place, groups and sets to win; validation mirrors the server's Tournament. */
export class TournamentForm {
  name = $state('');
  startsOn = $state('');
  endsOn = $state('');
  locationId = $state('');
  groupCount = $state(2);
  advancePerGroup = $state(2);
  setsToWin = $state(2);
  submitted = $state(false);

  readonly errors: Partial<Record<TournamentField, string>>;
  readonly valid: boolean;

  constructor(today: string) {
    this.startsOn = today;
    this.endsOn = today;
    this.errors = $derived(this.validate());
    this.valid = $derived(Object.keys(this.errors).length === 0);
  }

  error(field: TournamentField): string | null {
    return this.submitted ? (this.errors[field] ?? null) : null;
  }

  /** Teams in the knockout round. */
  get qualifiers(): number {
    return this.groupCount * this.advancePerGroup;
  }

  toNew(): NewTournament {
    return {
      name: this.name.trim(),
      startsOn: this.startsOn,
      endsOn: this.endsOn,
      locationId: this.locationId || null,
      appointmentId: null,
      groupCount: this.groupCount,
      advancePerGroup: this.advancePerGroup,
      setsToWin: this.setsToWin,
    };
  }

  private validate(): Partial<Record<TournamentField, string>> {
    const errors: Partial<Record<TournamentField, string>> = {};
    const name = this.name.trim();
    if (!name || name.length > 120) errors.name = 'Name mit 1 bis 120 Zeichen angeben.';
    if (!this.startsOn || !this.endsOn || this.endsOn < this.startsOn) errors.dates = 'Das Ende darf nicht vor dem Beginn liegen.';
    if (this.qualifiers < 2 || this.qualifiers > 32) errors.groups = 'Insgesamt 2 bis 32 Teams in der KO-Runde.';
    return errors;
  }
}
