import type { ApiClient } from '../http/ApiClient';
import { Formatter } from '../time/Formatter';
import { ZonedClock } from '../time/ZonedClock';
import { PRIVILEGED, type Club, type ClubEdit, type Me, type Member, type Role, type SecurityStatus, type Team } from '../types';

export type ProfilePatch = Partial<Pick<Member, 'firstName' | 'lastName' | 'birthDate' | 'phone' | 'photoConsent'>>;

/**
 * Club facts (public) and the signed-in member, loaded once and shared by all features.
 * `format` and `clock` follow the club's locale and time zone.
 */
export class SessionStore {
  club = $state.raw<Club | null>(null);
  me = $state.raw<Me | null>(null);

  #format: Formatter | null = null;
  #clock: ZonedClock | null = null;

  constructor(private readonly api: ApiClient) {}

  async loadClub(): Promise<Club> {
    const club = await this.api.get<Club>('/api/v1/club');
    this.#format = new Formatter(club.locale, club.timeZone);
    this.#clock = new ZonedClock(club.timeZone);
    this.club = club;
    return club;
  }

  async loadMe(): Promise<Me> {
    this.me = await this.api.get<Me>('/api/v1/me');
    return this.me;
  }

  clear(): void {
    this.me = null;
  }

  get format(): Formatter {
    if (!this.#format) throw new Error('Club not loaded');
    return this.#format;
  }

  get clock(): ZonedClock {
    if (!this.#clock) throw new Error('Club not loaded');
    return this.#clock;
  }

  /** The signed-in member; only call where the shell guarantees a loaded profile. */
  get member(): Member {
    if (!this.me) throw new Error('Member not loaded');
    return this.me.member;
  }

  /** The member's minors (server: members_guardian). */
  get wardIds(): readonly string[] {
    return this.me?.wardIds ?? [];
  }

  get teams(): readonly Team[] {
    return this.me?.teams ?? [];
  }

  hasRole(...roles: readonly Role[]): boolean {
    return this.me?.member.roles.some((r) => roles.includes(r)) ?? false;
  }

  get isPrivileged(): boolean {
    return this.hasRole(...PRIVILEGED);
  }

  isInTeam(teamId: string): boolean {
    return this.teams.some((t) => t.id === teamId);
  }

  teamName(teamId: string | null): string | null {
    return teamId ? (this.teams.find((t) => t.id === teamId)?.name ?? null) : null;
  }

  async updateProfile(patch: ProfilePatch): Promise<void> {
    await this.api.patch<Member>(`/api/v1/members/${this.member.id}`, patch);
    await this.loadMe();
  }

  /** Admin/board with step-up; time zone and locale stay as loaded (server: club.yml only). */
  async updateClub(edit: ClubEdit): Promise<void> {
    this.club = await this.api.put<Club>('/api/v1/club', edit);
  }

  /** Admin/board; once a club PIN exists the server asks for a step-up first. */
  setClubPin(pin: string): Promise<void> {
    return this.api.put('/api/v1/club/pin', { pin });
  }

  security(): Promise<SecurityStatus> {
    return this.api.get<SecurityStatus>('/api/v1/me/security');
  }
}
