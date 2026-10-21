import { FormState } from '../../lib/state/FormState.svelte';
import { groupChoices, groupPhase } from './logic';
import type { NewTournament, Tournament, TournamentFormat } from './model';

export type TournamentField = 'name' | 'dates' | 'groups' | 'fields';

/** server: Tournament.MAX_FIELDS */
export const MAX_FIELDS = 16;

/**
 * A new or edited tournament: name, days, place, groups, fields, format, sets to win and team size; validation mirrors
 * the server's Tournament. Group settings, fields and format change only before the draw (`settingsEditable`).
 */
export class TournamentForm extends FormState<Partial<Record<TournamentField, string>>> {
  name = $state('');
  startsOn = $state('');
  endsOn = $state('');
  locationId = $state('');
  groupCount = $state(2);
  advancePerGroup = $state(2);
  fieldCount = $state(1);
  format = $state<TournamentFormat>('VOLLEYBALL');
  setsToWin = $state(2);
  /** Beach only; volleyball teams always have 6, simple tournaments none. */
  beachTeamSize = $state(2);

  /** `teamCount`: teams entered so far (0 while creating), so the groups offered fit them. */
  constructor(
    today: string,
    readonly teamCount = 0,
    readonly original: Tournament | null = null,
  ) {
    super();
    this.startsOn = today;
    this.endsOn = today;
  }

  static from(t: Tournament): TournamentForm {
    const form = new TournamentForm(t.startsOn, t.teams.length, t);
    form.name = t.name;
    form.endsOn = t.endsOn;
    form.locationId = t.locationId ?? '';
    form.groupCount = t.groupCount;
    form.advancePerGroup = t.advancePerGroup;
    form.fieldCount = t.fieldCount;
    form.format = t.format;
    form.setsToWin = t.setsToWin;
    form.beachTeamSize = t.teamSize ?? 2;
    return form;
  }

  get settingsEditable(): boolean {
    return !this.original || this.original.status === 'DRAFT';
  }

  /** Teams in the knockout round. */
  get qualifiers(): number {
    return this.groupCount * this.advancePerGroup;
  }

  /** Group counts the entered teams allow (every count while there are none yet). */
  get groupOptions(): number[] {
    return groupChoices(this.teamCount, this.advancePerGroup);
  }

  /** Group matches and the fewest Durchgänge on the chosen fields; null until teams are entered. */
  get schedule(): { matches: number; waves: number } | null {
    return this.teamCount ? groupPhase(this.teamCount, this.groupCount, this.fieldCount) : null;
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
      format: this.format,
      setsToWin: this.format === 'VOLLEYBALL' ? this.setsToWin : 2,
      teamSize: this.format === 'BEACH' ? this.beachTeamSize : this.format === 'VOLLEYBALL' ? 6 : null,
      fieldCount: this.fieldCount,
    };
  }

  /** Changed values only: after the draw the server refuses any group setting, even an unchanged one. */
  toPatch(): Partial<NewTournament> {
    const next = this.toNew();
    const o = this.original!;
    const patch: Partial<NewTournament> = {};
    if (next.name !== o.name) patch.name = next.name;
    if (next.startsOn !== o.startsOn) patch.startsOn = next.startsOn;
    if (next.endsOn !== o.endsOn) patch.endsOn = next.endsOn;
    // shortcut: a place can be changed but not removed (null means "unchanged" on the server)
    if (next.locationId && next.locationId !== o.locationId) patch.locationId = next.locationId;
    if (this.settingsEditable) {
      for (const key of ['groupCount', 'advancePerGroup', 'format', 'setsToWin', 'teamSize', 'fieldCount'] as const) {
        if (next[key] !== null && next[key] !== o[key]) Object.assign(patch, { [key]: next[key] });
      }
    }
    return patch;
  }

  protected validate(): Partial<Record<TournamentField, string>> {
    const errors: Partial<Record<TournamentField, string>> = {};
    const name = this.name.trim();
    if (!name || name.length > 120) errors.name = 'Name mit 1 bis 120 Zeichen angeben.';
    if (!this.startsOn || !this.endsOn || this.endsOn < this.startsOn) errors.dates = 'Das Ende darf nicht vor dem Beginn liegen.';
    if (this.qualifiers < 2 || this.qualifiers > 32) errors.groups = 'Insgesamt 2 bis 32 Teams in der KO-Runde.';
    else if (this.settingsEditable && !this.groupOptions.includes(this.groupCount)) {
      errors.groups = `Für ${this.groupCount} Gruppen reichen ${this.teamCount} Teams nicht.`;
    }
    if (!Number.isInteger(this.fieldCount) || this.fieldCount < 1 || this.fieldCount > MAX_FIELDS) errors.fields = `1 bis ${MAX_FIELDS} Felder.`;
    return errors;
  }
}
