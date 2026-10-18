import type { ApiClient } from '../../lib/http/ApiClient';
import type { Member, MemberList, Role } from '../../lib/types';

export interface Invitation {
  email: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  phone: string | null;
  photoConsent: boolean;
  /** Optional guardian (e.g. a parent) for a minor, linked right away. */
  guardianId: string | null;
  roles: Role[];
}

export type ProfilePatch = Partial<Pick<Member, 'firstName' | 'lastName' | 'birthDate' | 'phone' | 'photoConsent'>>;

/** Typed access to the member administration endpoints. Every write needs a step-up. */
export class MembersApi {
  static readonly BASE = '/api/v1/members';

  constructor(private readonly api: ApiClient) {}

  async list(): Promise<Member[]> {
    return (await this.api.get<MemberList>(MembersApi.BASE)).items;
  }

  get(id: string): Promise<Member> {
    return this.api.get<Member>(this.path(id));
  }

  /** Creates the member and sends the invitation e-mail. */
  invite(invitation: Invitation): Promise<Member> {
    return this.api.post<Member>(MembersApi.BASE, invitation);
  }

  update(id: string, patch: ProfilePatch): Promise<Member> {
    return this.api.patch<Member>(this.path(id), patch);
  }

  setRoles(id: string, roles: readonly Role[]): Promise<Member> {
    return this.api.put<Member>(`${this.path(id)}/roles`, { roles });
  }

  deactivate(id: string): Promise<Member> {
    return this.api.post<Member>(`${this.path(id)}/deactivate`);
  }

  linkGuardian(minorId: string, guardianId: string): Promise<Member> {
    return this.api.post<Member>(`${this.path(minorId)}/guardians`, { guardianId });
  }

  /** The member must set a new PIN (and re-register devices). */
  resetSecurity(id: string): Promise<void> {
    return this.api.post(`${this.path(id)}/security/reset`);
  }

  /** Everyone must set a new PIN; the server requires the exact confirmation text. */
  async resetAllSecurity(confirm: string): Promise<number> {
    return (await this.api.post<{ pinsReset: number }>(`${MembersApi.BASE}/security/reset-all`, { confirm })).pinsReset;
  }

  private path(id: string): string {
    return `${MembersApi.BASE}/${encodeURIComponent(id)}`;
  }
}
