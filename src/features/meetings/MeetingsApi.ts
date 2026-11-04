import type { ApiClient } from '../../lib/http/ApiClient';
import type { RefKind } from '../../lib/records/refs';
import type {
  Choice,
  AgendaItemInput,
  ResolutionPatch,
  ResolutionSummary,
  Meeting,
  MeetingPatch,
  MeetingType,
  MeetingTypeInput,
  MeetingSummary,
  NewMeeting,
  NewResolution,
  Resolution,
  ResolutionRules,
  VoteMode,
} from './model';

/** Typed access to the meetings endpoints. */
export class MeetingsApi {
  static readonly BASE = '/api/v1/meetings';
  static readonly RESOLUTIONS = '/api/v1/resolutions';

  constructor(private readonly api: ApiClient) {}

  resolutionRules(): Promise<ResolutionRules> {
    return this.api.get<ResolutionRules>(`${MeetingsApi.BASE}/resolution-rules`);
  }

  /** Admin/board: the circular vote rules. */
  saveResolutionRules(rules: ResolutionRules): Promise<ResolutionRules> {
    return this.api.put<ResolutionRules>(`${MeetingsApi.BASE}/resolution-rules`, rules);
  }

  async types(): Promise<MeetingType[]> {
    return (await this.api.get<{ items: MeetingType[] }>(`${MeetingsApi.BASE}/types`)).items;
  }

  /** Admin/board; `key` null creates a type. */
  saveType(key: string | null, type: MeetingTypeInput): Promise<MeetingType> {
    return key
      ? this.api.put<MeetingType>(`${MeetingsApi.BASE}/types/${encodeURIComponent(key)}`, type)
      : this.api.post<MeetingType>(`${MeetingsApi.BASE}/types`, type);
  }

  /** Only types no meeting uses (`meeting-type.in-use`); archive the others. */
  deleteType(key: string): Promise<void> {
    return this.api.delete(`${MeetingsApi.BASE}/types/${encodeURIComponent(key)}`);
  }

  /** Visible meetings starting in [from, to), by start; open bounds when left out. */
  async list(from?: string, to?: string): Promise<MeetingSummary[]> {
    return (await this.api.get<{ items: MeetingSummary[] }>(MeetingsApi.BASE, { from, to })).items;
  }

  get(id: string): Promise<Meeting> {
    return this.api.get<Meeting>(this.path(id));
  }

  create(meeting: NewMeeting): Promise<Meeting> {
    return this.api.post<Meeting>(MeetingsApi.BASE, meeting);
  }

  update(id: string, patch: MeetingPatch): Promise<Meeting> {
    return this.api.patch<Meeting>(this.path(id), patch);
  }

  /** Only drafts. */
  delete(id: string): Promise<void> {
    return this.api.delete(this.path(id));
  }

  /** Sends the invitation to every club member (general meetings) or the board. */
  invite(id: string): Promise<Meeting> {
    return this.api.post<Meeting>(`${this.path(id)}/invite`);
  }

  open(id: string): Promise<Meeting> {
    return this.api.post<Meeting>(`${this.path(id)}/open`);
  }

  close(id: string, protocol: string): Promise<Meeting> {
    return this.api.post<Meeting>(`${this.path(id)}/close`, { protocol });
  }

  /** The whole Tagesordnung; items with a motion are Beschlüsse (server: MeetingsApi.AgendaItemInput). */
  setAgenda(id: string, items: readonly AgendaItemInput[]): Promise<Meeting> {
    return this.api.put<Meeting>(`${this.path(id)}/agenda`, { items });
  }

  setPresenceMany(id: string, memberIds: readonly string[], present: boolean): Promise<Meeting> {
    return this.api.put<Meeting>(`${this.path(id)}/presence`, { memberIds, present });
  }

  /** The voter themselves, while the meeting is open. */
  checkIn(id: string): Promise<Meeting> {
    return this.api.put<Meeting>(`${this.path(id)}/presence/me`);
  }

  /** Vorsitz and Schriftführer:in among those present; null: nobody. */
  setRoles(id: string, chairId: string | null, secretaryId: string | null): Promise<Meeting> {
    return this.api.put<Meeting>(`${this.path(id)}/roles`, { chairId, secretaryId });
  }

  approveProtocol(id: string): Promise<Meeting> {
    return this.api.post<Meeting>(`${this.path(id)}/protocol/approve`);
  }

  /** The protocol as a Word document in the meeting's folder, linked first. */
  generateProtocol(id: string): Promise<Meeting> {
    return this.api.post<Meeting>(`${this.path(id)}/protocol-document`);
  }

  updateResolution(id: string, patch: ResolutionPatch): Promise<Resolution> {
    return this.api.patch<Resolution>(this.resolutionPath(id), patch);
  }

  /** Every resolution the member sees, newest first; `year`: closed in that year. */
  async allResolutions(year: number | null = null): Promise<ResolutionSummary[]> {
    return (await this.api.get<{ items: ResolutionSummary[] }>(`${MeetingsApi.RESOLUTIONS}/all${year ? `?year=${year}` : ''}`)).items;
  }

  /** After the meeting: the protocol no longer changes. */
  finalizeProtocol(id: string): Promise<Meeting> {
    return this.api.post<Meeting>(`${this.path(id)}/protocol/final`);
  }

  /** Calls off an invited meeting; everyone invited is told. */
  cancel(id: string): Promise<Meeting> {
    return this.api.post<Meeting>(`${this.path(id)}/cancel`);
  }

  /** The invitation with agenda as a Word document in the meeting's folder (again: a new version); it is linked first. */
  generateInvitation(id: string): Promise<Meeting> {
    return this.api.post<Meeting>(`${this.path(id)}/invitation-document`);
  }

  /** Replaces the linked records. */
  setLinks(id: string, refs: readonly { kind: RefKind; id: string }[]): Promise<Meeting> {
    return this.api.put<Meeting>(`${this.path(id)}/links`, { refs: refs.map(({ kind, id: refId }) => ({ kind, id: refId })) });
  }

  setPresence(id: string, memberId: string, present: boolean): Promise<Meeting> {
    return this.api.put<Meeting>(`${this.path(id)}/presence/${encodeURIComponent(memberId)}`, { present });
  }

  // --- resolutions ---

  async resolutions(meetingId: string): Promise<Resolution[]> {
    return (await this.api.get<{ items: Resolution[] }>(`${this.path(meetingId)}/resolutions`)).items;
  }

  /** Circular votes of the board, newest first. */
  async circular(): Promise<Resolution[]> {
    return (await this.api.get<{ items: Resolution[] }>(MeetingsApi.RESOLUTIONS)).items;
  }

  resolution(id: string): Promise<Resolution> {
    return this.api.get<Resolution>(this.resolutionPath(id));
  }

  createResolution(meetingId: string, resolution: NewResolution): Promise<Resolution> {
    return this.api.post<Resolution>(`${this.path(meetingId)}/resolutions`, resolution);
  }

  /** Created and opened at once; whoever is named (empty: the board) gets the task "umsetzen" once it passes. */
  createCircular(
    title: string,
    text: string | null,
    deadline: string,
    assigneeIds: string[] = [],
    implementDue: string | null = null,
  ): Promise<Resolution> {
    return this.api.post<Resolution>(MeetingsApi.RESOLUTIONS, { title, text, deadline, assigneeIds, implementDue, open: true });
  }

  /** Replaces the records linked to a resolution. */
  setResolutionLinks(id: string, refs: readonly { kind: RefKind; id: string }[]): Promise<Resolution> {
    return this.api.put<Resolution>(`${this.resolutionPath(id)}/links`, { refs: refs.map(({ kind, id: refId }) => ({ kind, id: refId })) });
  }

  /** Who carries the resolution out; until it closes. */
  setResolutionAssignees(id: string, assigneeIds: readonly string[]): Promise<Resolution> {
    return this.api.put<Resolution>(`${this.resolutionPath(id)}/assignees`, { assigneeIds });
  }

  deleteResolution(id: string): Promise<void> {
    return this.api.delete(this.resolutionPath(id));
  }

  /** A meeting vote by show of hands or secretly in the app; circular votes need no mode. */
  openResolution(id: string, mode: VoteMode | null = null): Promise<Resolution> {
    return this.api.post<Resolution>(`${this.resolutionPath(id)}/open`, mode ? { mode } : undefined);
  }

  /** A circular vote runs longer (server: ResolutionHandlers.extend). */
  extendDeadline(id: string, deadline: string): Promise<Resolution> {
    return this.api.put<Resolution>(`${this.resolutionPath(id)}/deadline`, { deadline });
  }

  closeResolution(id: string): Promise<Resolution> {
    return this.api.post<Resolution>(`${this.resolutionPath(id)}/close`);
  }

  vote(id: string, choice: Choice): Promise<Resolution> {
    return this.api.post<Resolution>(`${this.resolutionPath(id)}/vote`, { choice });
  }

  /** Circular votes: a written vote of a board member. */
  recordVote(id: string, memberId: string, choice: Choice): Promise<Resolution> {
    return this.api.post<Resolution>(`${this.resolutionPath(id)}/recorded-vote`, { memberId, choice });
  }

  /** Meetings: the room's sums for members without the app, once. */
  analogVotes(id: string, yes: number, no: number, abstain: number): Promise<Resolution> {
    return this.api.post<Resolution>(`${this.resolutionPath(id)}/analog-votes`, { yes, no, abstain });
  }

  /** Show of hands: the counts and closing in one step ("Einstimmig", "Ergebnis eintragen"). */
  handResult(id: string, yes: number, no: number, abstain: number): Promise<Resolution> {
    return this.api.post<Resolution>(`${this.resolutionPath(id)}/hand-result`, { yes, no, abstain });
  }

  private resolutionPath(id: string): string {
    return `${MeetingsApi.RESOLUTIONS}/${encodeURIComponent(id)}`;
  }

  private path(id: string): string {
    return `${MeetingsApi.BASE}/${encodeURIComponent(id)}`;
  }
}
