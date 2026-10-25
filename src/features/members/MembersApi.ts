import type { ApiClient } from '../../lib/http/ApiClient';
import type { Member, MemberList, MembershipType, Role } from '../../lib/types';

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
  /** The server sets memberSince to today when given. */
  membershipType: MembershipType | null;
}

export interface Membership {
  membershipType: MembershipType | null;
  honorary: boolean;
  memberSince: string | null;
}

/** Vorstand functions (statutes §9) and Rechnungsprüfer (§11, not part of the board). */
export type OfficeKind = 'CHAIR' | 'VICE_CHAIR' | 'TREASURER' | 'SECRETARY' | 'BOARD_MEMBER' | 'AUDITOR';

export const OFFICE_KINDS: readonly OfficeKind[] = ['CHAIR', 'VICE_CHAIR', 'TREASURER', 'SECRETARY', 'BOARD_MEMBER', 'AUDITOR'];

/** The statutes' names; the club's own come with the board settings (`boardSettings.label`). */
export const OFFICE_LABELS: Readonly<Record<OfficeKind, string>> = {
  CHAIR: 'Vorsitz',
  VICE_CHAIR: 'Stellvertretung',
  TREASURER: 'Kassier:in',
  SECRETARY: 'Schriftführung',
  BOARD_MEMBER: 'Vorstandsmitglied',
  AUDITOR: 'Rechnungsprüfer:in',
};

export interface Office {
  id: string;
  memberId: string;
  name: string;
  office: OfficeKind;
  startsOn: string;
  termEndsOn: string;
  endedOn: string | null;
  /** Chosen by the board until the next general meeting confirms it (§9 Abs 6). */
  coopted: boolean;
}

export interface NewOffice {
  memberId: string;
  office: OfficeKind;
  startsOn: string;
  /** null = the full term of the office (club setting). */
  termEndsOn: string | null;
  coopted: boolean;
}

/** server: MembersApi.OfficeSetting — `maxHolders` null: any number; a disabled office is not assigned any more. */
export interface OfficeSetting {
  office: OfficeKind;
  label: string;
  enabled: boolean;
  /** Fewer is a warning on the board page. */
  minHolders: number;
  maxHolders: number | null;
  termYears: number;
}

/** server: MembersApi.BoardSettings — every office once, plus the board-wide rules (§9 Abs 1, 6). */
export interface BoardSettings {
  offices: OfficeSetting[];
  minBoardSize: number;
  oddBoardSize: boolean;
  /** Weeks to co-opt after an early resignation; 0 = by-election at once. */
  cooptWeeks: number;
  termWarningDays: number;
  byElectionDays: number;
}

/** Running offices; warnings are codes like 'board.too-small' (texts in BOARD_WARNINGS). */
export interface Board {
  offices: Office[];
  warnings: string[];
}

/** Account data a member cannot change alone; admin/board decide on a request. */
export type ChangeField = 'EMAIL' | 'FIRST_NAME' | 'LAST_NAME' | 'BIRTH_DATE';
export type ChangeStatus = 'OPEN' | 'APPROVED' | 'REJECTED';

export const CHANGE_FIELD_LABELS: Readonly<Record<ChangeField, string>> = {
  EMAIL: 'E-Mail',
  FIRST_NAME: 'Vorname',
  LAST_NAME: 'Nachname',
  BIRTH_DATE: 'Geburtsdatum',
};

export interface ChangeRequest {
  id: string;
  memberId: string;
  memberName: string;
  field: ChangeField;
  currentValue: string | null;
  newValue: string;
  note: string | null;
  status: ChangeStatus;
  decidedBy: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export type ProfilePatch = Partial<Pick<Member, 'firstName' | 'lastName' | 'birthDate' | 'phone' | 'photoConsent'>>;

/** Typed access to the member administration endpoints. Every write needs a step-up. */
/** A guardian or ward on a member's profile; `canOpen`: the viewer may open that profile too (server: MembersApi.Relative). */
export interface Relative {
  memberId: string;
  name: string;
  canOpen: boolean;
}

/** server: MembersApi.Family */
export interface Family {
  guardians: Relative[];
  wards: Relative[];
}

/** A linked guardian of a member (server: MembersApi.GuardianRef). */
export interface GuardianRef {
  memberId: string;
  name: string;
}

export class MembersApi {
  static readonly BASE = '/api/v1/members';

  constructor(private readonly api: ApiClient) {}

  list(): Promise<MemberList> {
    return this.api.get<MemberList>(MembersApi.BASE);
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

  setMembership(id: string, membership: Membership): Promise<Member> {
    return this.api.put<Member>(`${this.path(id)}/membership`, membership);
  }

  boardSettings(): Promise<BoardSettings> {
    return this.api.get<BoardSettings>('/api/v1/board/settings');
  }

  /** Admin/board with step-up; running offices keep their terms. */
  saveBoardSettings(settings: BoardSettings): Promise<BoardSettings> {
    return this.api.put<BoardSettings>('/api/v1/board/settings', settings);
  }

  board(): Promise<Board> {
    return this.api.get<Board>('/api/v1/board/offices');
  }

  /** The holder gets the BOARD role with a board office. */
  assignOffice(office: NewOffice): Promise<Office> {
    return this.api.post<Office>('/api/v1/board/offices', office);
  }

  endOffice(id: string): Promise<Office> {
    return this.api.post<Office>(`/api/v1/board/offices/${encodeURIComponent(id)}/end`);
  }

  deactivate(id: string): Promise<Member> {
    return this.api.post<Member>(`${this.path(id)}/deactivate`);
  }

  reactivate(id: string): Promise<Member> {
    return this.api.post<Member>(`${this.path(id)}/reactivate`);
  }

  /** GDPR erasure of a deactivated member (admin): personal data overwritten, login deleted. */
  erase(id: string): Promise<void> {
    return this.api.post(`${this.path(id)}/erase`);
  }

  /** Guardians and wards, for who may open the member's profile. */
  family(id: string): Promise<Family> {
    return this.api.get<Family>(`${this.path(id)}/family`);
  }

  async guardians(minorId: string): Promise<GuardianRef[]> {
    return (await this.api.get<{ items: GuardianRef[] }>(`${this.path(minorId)}/guardians`)).items;
  }

  unlinkGuardian(minorId: string, guardianId: string): Promise<Member> {
    return this.api.delete<Member>(`${this.path(minorId)}/guardians/${encodeURIComponent(guardianId)}`);
  }

  linkGuardian(minorId: string, guardianId: string): Promise<Member> {
    return this.api.post<Member>(`${this.path(minorId)}/guardians`, { guardianId });
  }

  /** Sets the login e-mail directly (admin/board). */
  changeEmail(id: string, email: string): Promise<Member> {
    return this.api.put<Member>(`${this.path(id)}/email`, { email });
  }

  /** The signed-in member asks admin/board to change a field. */
  requestChange(field: ChangeField, value: string, note: string | null): Promise<ChangeRequest> {
    return this.api.post<ChangeRequest>('/api/v1/me/change-requests', { field, value, note });
  }

  async ownChangeRequests(): Promise<ChangeRequest[]> {
    return (await this.api.get<{ items: ChangeRequest[] }>('/api/v1/me/change-requests')).items;
  }

  changeRequest(id: string): Promise<ChangeRequest> {
    return this.api.get<ChangeRequest>(`${MembersApi.BASE}/change-requests/${encodeURIComponent(id)}`);
  }

  /** Approving applies the change; either way the request's task is finished and the member is told. */
  decideChange(id: string, approve: boolean): Promise<ChangeRequest> {
    return this.api.post<ChangeRequest>(`${MembersApi.BASE}/change-requests/${encodeURIComponent(id)}/${approve ? 'approve' : 'reject'}`);
  }

  /** Unlocks the club PIN for the member and removes their device keys and step-ups. */
  resetSecurity(id: string): Promise<void> {
    return this.api.post(`${this.path(id)}/security/reset`);
  }

  private path(id: string): string {
    return `${MembersApi.BASE}/${encodeURIComponent(id)}`;
  }
}
