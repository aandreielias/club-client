import { FormState } from '../../lib/state/FormState.svelte';
import { settings } from '../../settings';
import { yearLabel, yearOf } from '../../lib/time/clubYear';
import type { ZonedClock } from '../../lib/time/ZonedClock';

export type TeamFormErrors = Partial<Record<'name' | 'season', string>>;

/** A new team: name plus season ("2026/27", or "2026" when seasons start in January), the season defaulting to the current one. */
export class TeamForm extends FormState<TeamFormErrors> {
  name = $state('');
  season = $state('');

  constructor(clock: ZonedClock, seasonStartMonth: number) {
    super();
    this.season = TeamForm.currentSeason(clock.today(), seasonStartMonth);
  }

  /** '2026-10-15' with start month 7 → '2026/27'; '2027-03-01' → '2026/27'; start month 1 → '2027'. */
  static currentSeason(today: string, startMonth: number): string {
    return yearLabel(yearOf(today, startMonth), startMonth);
  }

  protected validate(): TeamFormErrors {
    const errors: TeamFormErrors = {};
    const max = settings.teams.nameMaxLength;
    const name = this.name.trim();
    if (!name || name.length > max) errors.name = `Name mit 1 bis ${max} Zeichen angeben.`;
    if (!new RegExp(settings.teams.seasonPattern).test(this.season.trim())) errors.season = 'Saison wie 2026 oder 2026/27 angeben.';
    return errors;
  }
}
