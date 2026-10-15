// Mirrors of club-server DTOs shared by several features. Feature-only DTOs live in the feature's model.ts.

/** Hues of the tag palette (settings.theme.colors.*.tag*); used for statuses, types and calendar entries. */
export type Hue = 'gray' | 'brown' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'red';

export type Role = 'ADMIN' | 'BOARD' | 'COACH' | 'PLAYER' | 'PARENT' | 'VOLUNTEER';

export type TeamRole = 'COACH' | 'PLAYER';

/** Roles that need a PIN and a step-up for privileged changes (server: Actor.PRIVILEGED). */
export const PRIVILEGED: readonly Role[] = ['ADMIN', 'BOARD', 'COACH'];

/** Roles that manage the whole club (server: Role.ADMIN, Role.BOARD checks). */
export const MANAGERS: readonly Role[] = ['ADMIN', 'BOARD'];

export const ROLE_LABELS: Readonly<Record<Role, string>> = {
  ADMIN: 'Admin',
  BOARD: 'Vorstand',
  COACH: 'Trainer:in',
  PLAYER: 'Spieler:in',
  PARENT: 'Elternteil',
  VOLUNTEER: 'Helfer:in',
};

export interface Club {
  name: string;
  shortName: string;
  sport: string;
  country: string;
  timeZone: string;
  locale: string;
  website: string | null;
  contactEmail: string | null;
}

export interface Member {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  /** ISO date; null when unset or hidden from the viewer. */
  birthDate: string | null;
  phone: string | null;
  photoConsent: boolean;
  active: boolean;
  roles: Role[];
}

export interface MemberList {
  items: Member[];
}

export interface Team {
  id: string;
  name: string;
  season: string;
}

export interface RosterEntry {
  memberId: string;
  name: string;
  teamRole: TeamRole;
}

export interface Roster {
  team: Team;
  entries: RosterEntry[];
}

export type MissingProfileField = 'birthDate' | 'pin';

export interface Me {
  member: Member;
  teams: Team[];
  missing: MissingProfileField[];
}

export interface Device {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface SecurityStatus {
  pinRequired: boolean;
  pinSet: boolean;
  pinLocked: boolean;
  stepUpUntil: string | null;
  devices: Device[];
}

export interface StepUp {
  until: string;
}
