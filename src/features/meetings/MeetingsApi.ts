import type { ApiClient } from '../../lib/http/ApiClient';
import type { Meeting, MeetingPatch, MeetingSummary, NewMeeting, PresenceMode } from './model';

/** Typed access to the meetings endpoints. Every write needs a step-up and answers with the meeting. */
export class MeetingsApi {
  static readonly BASE = '/api/v1/meetings';

  constructor(private readonly api: ApiClient) {}

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

  /** null = not there. */
  setPresence(id: string, memberId: string, mode: PresenceMode | null): Promise<Meeting> {
    return this.api.put<Meeting>(`${this.path(id)}/presence/${encodeURIComponent(memberId)}`, { mode });
  }

  private path(id: string): string {
    return `${MeetingsApi.BASE}/${encodeURIComponent(id)}`;
  }
}
