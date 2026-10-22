// Live event types of the meetings module (server: MeetingsApi.MeetingChanged).

import { liveEvent } from '../../lib/live/LiveUpdates.svelte';

export const MEETING_CHANGED = liveEvent<MeetingChanged>('meetings.meeting-changed');

export interface MeetingChanged {
  meetingId: string;
  change: 'CREATED' | 'UPDATED' | 'INVITED' | 'PRESENCE' | 'OPENED' | 'CLOSED' | 'DELETED';
}
