// Mirrors of the club-server tournaments DTOs (TournamentsApi).

export type TournamentStatus = 'DRAFT' | 'GROUPS' | 'KO' | 'DONE';
export type Stage = 'GROUP' | 'KO';

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
  pointsWin: number;
  pointsDraw: number;
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
  pointsWin: number;
  pointsDraw: number;
}

export interface TeamInput {
  id: string | null;
  name: string;
  clubTeamId: string | null;
}

/** The points of every set; empty removes the result. */
export interface ResultInput {
  sets: SetScore[];
  startsAt: string | null;
  field: string | null;
}

export interface GuestInput {
  teamId: string | null;
  email: string;
  firstName: string;
  lastName: string;
}

export const STATUS_LABELS: Readonly<Record<TournamentStatus, string>> = {
  DRAFT: 'In Planung',
  GROUPS: 'Gruppenphase',
  KO: 'KO-Runde',
  DONE: 'Beendet',
};

export const STATUS_TONES = { DRAFT: 'gray', GROUPS: 'blue', KO: 'purple', DONE: 'green' } as const;
