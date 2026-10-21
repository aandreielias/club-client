import { Action } from '../../lib/state/Action.svelte';
import { Resource } from '../../lib/state/Resource.svelte';
import type { GuestInput, NewTournament, ResultInput, TeamInput, Tournament, TournamentMatch } from './model';
import type { TournamentsApi } from './TournamentsApi';

/** One tournament and the steps of running it; every answer is the whole tournament, so it replaces the shown one. */
export class TournamentModel {
  readonly tournament: Resource<Tournament>;
  readonly action = new Action();

  constructor(
    private readonly api: TournamentsApi,
    readonly id: string,
  ) {
    this.tournament = new Resource(() => this.api.get(id));
  }

  load(): Promise<void> {
    return this.tournament.load();
  }

  teamName(teamId: string | null): string | null {
    return this.tournament.value?.teams.find((t) => t.id === teamId)?.name ?? null;
  }

  /** Group matches that still need a result. */
  get openGroupMatches(): number {
    return this.tournament.value?.matches.filter((m) => m.stage === 'GROUP' && m.homeScore === null).length ?? 0;
  }

  /** The tournament's winner once the final is played. */
  get champion(): string | null {
    const ko = this.tournament.value?.matches.filter((m) => m.stage === 'KO') ?? [];
    const last = Math.max(0, ...ko.map((m) => m.round));
    const final = ko.find((m) => m.round === last);
    return final ? this.teamName(TournamentModel.winner(final)) : null;
  }

  static winner(m: TournamentMatch): string | null {
    // A bye exists only in the first knockout round; later, a missing opponent is not decided yet.
    if (m.homeId && !m.awayId && m.stage === 'KO' && m.round === 1) return m.homeId;
    if (m.homeScore === null || m.awayScore === null) return null;
    return m.homeScore > m.awayScore ? m.homeId : m.awayScore > m.homeScore ? m.awayId : null;
  }

  setTeams(teams: readonly TeamInput[]): Promise<boolean> {
    return this.run(() => this.api.setTeams(this.id, teams));
  }

  draw(): Promise<boolean> {
    return this.run(() => this.api.draw(this.id));
  }

  startKnockout(): Promise<boolean> {
    return this.run(() => this.api.startKnockout(this.id));
  }

  setResult(matchId: string, result: ResultInput): Promise<boolean> {
    return this.run(() => this.api.setResult(this.id, matchId, result));
  }

  update(patch: Partial<NewTournament>): Promise<boolean> {
    return this.run(() => this.api.update(this.id, patch));
  }

  inviteGuest(guest: GuestInput): Promise<boolean> {
    return this.run(() => this.api.inviteGuest(this.id, guest));
  }

  private run(write: () => Promise<Tournament>): Promise<boolean> {
    return this.action.run(async () => this.tournament.set(await write()));
  }
}
