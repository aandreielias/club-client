// Mirrors of club-server DTOs shared by several features. Feature-only DTOs live in the feature's model.ts.

/** Hues of the tag palette (settings.theme.colors.*.tag*); used for statuses, types and calendar entries. */
export type Hue = 'gray' | 'brown' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'red';

/** GUEST: temporary account of a visiting tournament team; sees only that tournament. */
export type Role = 'ADMIN' | 'BOARD' | 'COACH' | 'PLAYER' | 'PARENT' | 'VOLUNTEER' | 'GUEST';

/** Only GUEST (server: Actor.guestOnly). */
export const guestOnly = (roles: readonly Role[]): boolean => roles.length === 1 && roles[0] === 'GUEST';

/** ASSISTANT: co-coach, with the same rights in the team as COACH (server: TeamRole.coaches). */
export type TeamRole = 'COACH' | 'ASSISTANT' | 'PLAYER';

/** Coaches and co-coaches run the team. */
export const coaches = (role: TeamRole | null | undefined): boolean => role === 'COACH' || role === 'ASSISTANT';

export const TEAM_ROLE_LABELS: Readonly<Record<TeamRole, string>> = { PLAYER: 'Spieler:in', COACH: 'Trainer:in', ASSISTANT: 'Co-Trainer:in' };

/** Task status names, shown by the tasks and search features. */
export const TASK_STATUS_LABELS = { OPEN: 'Offen', IN_PROGRESS: 'In Arbeit', DONE: 'Erledigt' } as const;

/** Roles that change club data (server: Actor.PRIVILEGED). */
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

const ROLE_HUES: Readonly<Record<Role, Hue>> = {
  ADMIN: 'red',
  BOARD: 'purple',
  COACH: 'blue',
  PLAYER: 'green',
  PARENT: 'orange',
  VOLUNTEER: 'brown',
  GUEST: 'gray',
};

/** Tag colour of a club role. */
export const roleHue = (role: Role): Hue => ROLE_HUES[role];

/** Key of a club-defined membership kind (server: members_membership_kind); seeded ORDINARY, EXTRAORDINARY. */
export type MembershipType = string;

export interface Club {
  name: string;
  shortName: string;
  sport: string;
  country: string;
  timeZone: string;
  locale: string;
  website: string | null;
  contactEmail: string | null;
  address: string | null;
  /** Number in the register of associations. */
  registerNumber: string | null;
  /** Month (1-12) in which a new season starts, e.g. for the default season of a new team. */
  seasonStartMonth: number;
  /** Colours, fonts and logos the Vorstand chose (Einstellungen > Erscheinungsbild). */
  brand: Brand;
  assets: BrandAssets;
  /** The club saved its facts once; until then admins see the setup page. */
  configured: boolean;
}

/** Fonts a club may pick (server: Brand.Font); the client bundles each. */
export type BrandFont = 'INTER' | 'ANTON' | 'OSWALD' | 'ROBOTO' | 'SOURCE_SERIF' | 'SYSTEM';

/** server: platform.club.Brand; colours as #RRGGBB, radii in px. */
export interface Brand {
  primary: string;
  primaryHover: string;
  /** Small marks only (active entry, unread dot), never text or areas. */
  accent: string;
  text: string;
  textMuted: string;
  /** Quiet background areas. */
  tint: string;
  line: string;
  headingFont: BrandFont;
  textFont: BrandFont;
  headingCaps: boolean;
  radiusSmall: number;
  radiusLarge: number;
  /** Browser tab name; null = the club's name. */
  appName: string | null;
  mailGreeting: string | null;
  mailSignOff: string | null;
  mailFooter: string | null;
}

/** URLs of the uploaded images (versioned), null when none. */
export interface BrandAssets {
  logo: string | null;
  logoSecondary: string | null;
  favicon: string | null;
}

/** What admins and the board edit (server: PUT /club); empty values fall back to club.yml. */
/** A sample e-mail in a draft of the brand (Einstellungen › Erscheinungsbild). */
export interface MailPreview {
  subject: string;
  html: string;
}

export type ClubEdit = Pick<Club, 'name' | 'shortName' | 'website' | 'contactEmail' | 'address' | 'registerNumber' | 'seasonStartMonth'>;

export interface Member {
  id: string;
  /** null: a member without a login (a child, someone without e-mail); guardians act for them. */
  email: string | null;
  firstName: string;
  /** Optional second given name; null when none. */
  middleName: string | null;
  lastName: string;
  /** ISO date; null when unset or hidden from the viewer. */
  birthDate: string | null;
  phone: string | null;
  photoConsent: boolean;
  active: boolean;
  roles: Role[];
  /** The member's kinds in the club's order; empty: no club member (e.g. parents, guests). Several only when the club allows it. */
  membershipTypes: MembershipType[];
  /** With one kind per member: the kind an honorary member had before (offered back on revoke). */
  previousType: MembershipType | null;
  /** ISO date. */
  memberSince: string | null;
  /** Votes in the general meeting (server: MembershipRules). */
  voter: boolean;
  /** May be elected into an office. */
  eligible: boolean;
  /** Has an account; members without one never sign in (an admin invites them once an e-mail is set). */
  login: boolean;
}

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
  /** A past season: kept with its history, out of pickers. */
  archived?: boolean;
}

export interface RosterEntry {
  memberId: string;
  name: string;
  teamRole: TeamRole;
  /** Shirt number 0–99. */
  jersey?: number | null;
  position?: string | null;
  captain?: boolean;
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

/** server: AuditLog.AuditEntry */
export interface AuditEntry {
  id: number;
  at: string;
  actorId: string;
  actorName: string | null;
  method: string;
  route: string;
  params: Record<string, string>;
  status: number;
}
