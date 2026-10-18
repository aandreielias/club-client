// Mirrors of the club-server tournaments DTOs (TournamentsApi).

export type TournamentStatus = 'DRAFT' | 'GROUPS' | 'KO' | 'DONE';
export type Stage = 'GROUP' | 'KO';
/** Indoor volleyball (teams of 6), beach volleyball (2 to 4 per team, sets to 21) or simple (only who won). */
export type TournamentFormat = 'VOLLEYBALL' | 'BEACH' | 'SIMPLE';
/** Result of a simple match; a draw only in the groups. */
export type Outcome = 'HOME' | 'AWAY' | 'DRAW';

export interface TournamentTeam {
  id: string;
  name: string;
  /** One of the club's own teams. */
  clubTeamId: string | null;
  /** Group label after the draw. */
  group: string | null;
}

/** Points of one volleyball set. */
export interface SetScore {
  home: number;
  away: number;
}

export interface TournamentMatch {
  id: string;
  stage: Stage;
  group: string | null;
  round: number;
  slot: number;
  homeId: string | null;
  awayId: string | null;
  /** Sets won; null while no set is entered. */
  homeScore: number | null;
  awayScore: number | null;
  /** Points of every set. */
  sets: SetScore[];
  startsAt: string | null;
  field: string | null;
}

export interface StandingRow {
  teamId: string;
  name: string;
  played: number;
  won: number;
  /** Only simple matches end in a draw. */
  drawn: number;
  lost: number;
  setsWon: number;
  setsLost: number;
  /** Ball points. */
  ballsWon: number;
  ballsLost: number;
  points: number;
}

export interface TournamentGroup {
  label: string;
  standings: StandingRow[];
}

export interface Guest {
  memberId: string;
  name: string;
  teamId: string | null;
  /** The account is deleted on this day. */
  deletedOn: string;
}

export interface Tournament {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  locationId: string | null;
  appointmentId: string | null;
  groupCount: number;
  advancePerGroup: number;
  format: TournamentFormat;
  /** Sets a team needs to win a match: 2 (best of 3) or 3 (best of 5); beach always 2. */
  setsToWin: number;
  /** Players per team: 6 for volleyball, 2 to 4 for beach, null for simple. */
  teamSize: number | null;
  status: TournamentStatus;
  teams: TournamentTeam[];
  groups: TournamentGroup[];
  matches: TournamentMatch[];
  /** Only for admin, board and coaches. */
  guests: Guest[];
}

export interface TournamentSummary {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  status: TournamentStatus;
  teams: number;
}

export interface NewTournament {
  name: string;
  startsOn: string;
  endsOn: string;
  locationId: string | null;
  appointmentId: string | null;
  groupCount: number;
  advancePerGroup: number;
  format: TournamentFormat;
  setsToWin: number;
  teamSize: number | null;
}

export interface TeamInput {
  id: string | null;
  name: string;
  clubTeamId: string | null;
}

/** The points of every set; empty removes the result. */
export interface ResultInput {
  sets: SetScore[];
  /** Simple tournaments only; no sets and no outcome removes the result. */
  outcome: Outcome | null;
  startsAt: string | null;
  field: string | null;
}

export interface GuestInput {
  teamId: string | null;
  email: string;
  firstName: string;
  lastName: string;
}

export const FORMAT_LABELS: Readonly<Record<TournamentFormat, string>> = {
  VOLLEYBALL: 'Volleyball',
  BEACH: 'Beachvolleyball',
  SIMPLE: 'Einfach',
};

export const STATUS_LABELS: Readonly<Record<TournamentStatus, string>> = {
  DRAFT: 'In Planung',
  GROUPS: 'Gruppenphase',
  KO: 'KO-Runde',
  DONE: 'Beendet',
};

export const STATUS_TONES = { DRAFT: 'gray', GROUPS: 'blue', KO: 'purple', DONE: 'green' } as const;
