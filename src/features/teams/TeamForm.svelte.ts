import { settings } from '../../settings';
import type { ZonedClock } from '../../lib/time/ZonedClock';

export type TeamFormErrors = Partial<Record<'name' | 'season', string>>;

/** A new team: name plus season ("2026/27"), the season defaulting to the current one. */
export class TeamForm {
  name = $state('');
  season = $state('');
  submitted = $state(false);

  readonly errors: TeamFormErrors;
  readonly valid: boolean;

  constructor(clock: ZonedClock) {
    this.season = TeamForm.currentSeason(clock.today(), settings.teams.seasonStartMonth);
    this.errors = $derived(this.validate());
    this.valid = $derived(Object.keys(this.errors).length === 0);
  }

  error(field: keyof TeamFormErrors): string | null {
    return this.submitted ? (this.errors[field] ?? null) : null;
  }

  /** '2026-10-15' with start month 7 → '2026/27'; '2027-03-01' → '2026/27'. */
  static currentSeason(today: string, startMonth: number): string {
    const [year, month] = today.split('-').map(Number);
    const first = month >= startMonth ? year : year - 1;
    return `${first}/${String((first + 1) % 100).padStart(2, '0')}`;
  }

  private validate(): TeamFormErrors {
    const errors: TeamFormErrors = {};
    const max = settings.teams.nameMaxLength;
    const name = this.name.trim();
    if (!name || name.length > max) errors.name = `Name mit 1 bis ${max} Zeichen angeben.`;
    if (!new RegExp(settings.teams.seasonPattern).test(this.season.trim())) errors.season = 'Saison im Format 2026/27 angeben.';
    return errors;
  }
}
