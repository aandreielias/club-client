import type { ApiClient } from '../http/ApiClient';
import { Formatter } from '../time/Formatter';
import { ZonedClock } from '../time/ZonedClock';
import { type Brand, type Club, type ClubEdit, type Me, type Member, type Role, type Team } from '../types';

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

  /** `assetBase`: origin of the server, put before the brand images' paths (they are served by the API). */
  constructor(
    private readonly api: ApiClient,
    private readonly assetBase = '',
  ) {}

  async loadClub(): Promise<Club> {
    const club = this.setClub(await this.api.get<Club>('/api/v1/club'));
    this.#format = new Formatter(club.locale, club.timeZone);
    this.#clock = new ZonedClock(club.timeZone);
    return club;
  }

  /** Takes the club facts (loaded, saved or pushed live). */
  setClub(club: Club): Club {
    const url = (path: string | null) => (path?.startsWith('/') ? this.assetBase + path : path);
    const { logo, logoSecondary, favicon } = club.assets;
    this.club = { ...club, assets: { logo: url(logo), logoSecondary: url(logoSecondary), favicon: url(favicon) } };
    return this.club;
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

  /** Admin/board; time zone and locale stay as loaded (server: club.yml only). */
  async updateClub(edit: ClubEdit): Promise<void> {
    this.setClub(await this.api.put<Club>('/api/v1/club', edit));
  }

  /** Erscheinungsbild (admin/board). */
  async updateBrand(brand: Brand): Promise<void> {
    this.setClub(await this.api.put<Club>('/api/v1/club/brand', brand));
  }

  /** Back to the server's default look; the logos (setting files) stay. */
  async resetBrand(): Promise<void> {
    this.setClub(await this.api.delete<Club>('/api/v1/club/brand'));
  }

  /** Everything the club keeps about the member (or a ward), as the server's JSON export. */
  exportData(memberId?: string): Promise<unknown> {
    return this.api.get('/api/v1/me/export', memberId ? { memberId } : undefined);
  }
}
