// Mirrors of club-server DTOs shared by several features. Feature-only DTOs live in the feature's model.ts.

/** Hues of the tag palette (settings.theme.colors.*.tag*); used for statuses, types and calendar entries. */
export type Hue = 'gray' | 'brown' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'red';

/** GUEST: temporary account of a visiting tournament team; sees only that tournament. */
export type Role = 'ADMIN' | 'BOARD' | 'COACH' | 'PLAYER' | 'PARENT' | 'VOLUNTEER' | 'GUEST';

/** Only GUEST (server: Actor.guestOnly). */
export const guestOnly = (roles: readonly Role[]): boolean => roles.length === 1 && roles[0] === 'GUEST';

export type TeamRole = 'COACH' | 'PLAYER';

export const TEAM_ROLE_LABELS: Readonly<Record<TeamRole, string>> = { PLAYER: 'Spieler:in', COACH: 'Trainer:in' };

/** Task status names, shown by the tasks and search features. */
export const TASK_STATUS_LABELS = { OPEN: 'Offen', IN_PROGRESS: 'In Arbeit', DONE: 'Erledigt' } as const;

/** Roles that need a PIN and a step-up for privileged changes (server: Actor.PRIVILEGED). */
export const PRIVILEGED: readonly Role[] = ['ADMIN', 'BOARD', 'COACH'];

/** Admin and board: they manage the whole club (server: checks for Role.ADMIN, Role.BOARD; not the server's MANAGERS, which adds coaches). */
export const ADMIN_BOARD: readonly Role[] = ['ADMIN', 'BOARD'];

export const ROLE_LABELS: Readonly<Record<Role, string>> = {
  ADMIN: 'Admin',
  BOARD: 'Vorstand',
  COACH: 'Trainer:in',
  PLAYER: 'Spieler:in',
  PARENT: 'Elternteil',
  VOLUNTEER: 'Helfer:in',
  GUEST: 'Gast',
};

/** Statutes §4: ordinary members take part, extraordinary members also help run the club and vote (§8 Abs 1). */
export type MembershipType = 'ORDINARY' | 'EXTRAORDINARY';

export const MEMBERSHIP_LABELS: Readonly<Record<MembershipType, string>> = { ORDINARY: 'Ordentlich', EXTRAORDINARY: 'Außerordentlich' };

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
  /** null and not honorary: no club member (e.g. parents, guests). */
  membershipType: MembershipType | null;
  honorary: boolean;
  /** ISO date. */
  memberSince: string | null;
}

/** server: Member.canVote — votes and may hold an office. */
export const canVote = (m: Member): boolean => m.active && (m.membershipType === 'EXTRAORDINARY' || m.honorary);

export interface MemberList {
  items: Member[];
  /** Under 18 today (also when the birth date is hidden). */
  minorIds: string[];
  /** Members with a linked guardian. */
  wardIds: string[];
  /** Members linked as guardian. */
  guardianIds: string[];
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

export type MissingProfileField = 'birthDate';

export interface Me {
  member: Member;
  teams: Team[];
  missing: MissingProfileField[];
  /** The member's minors; their tasks count as the member's own. */
  wardIds: string[];
  /** Names of the minors, also for members who may not open member profiles. */
  wardNames: Record<string, string>;
}

export interface Device {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface SecurityStatus {
  clubPinSet: boolean;
  clubPinChangedAt: string | null;
  /** Too many wrong club-PIN tries by this member; an admin must unlock. */
  pinLocked: boolean;
  stepUpUntil: string | null;
  devices: Device[];
}

export interface StepUp {
  until: string;
}
