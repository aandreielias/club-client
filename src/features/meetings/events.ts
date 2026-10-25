// Live event types of the meetings module (server: MeetingsApi.MeetingChanged).

import { liveEvent } from '../../lib/live/LiveUpdates.svelte';

export const MEETING_CHANGED = liveEvent<MeetingChanged>('meetings.meeting-changed');

export interface MeetingChanged {
  meetingId: string;
  change: 'CREATED' | 'UPDATED' | 'INVITED' | 'PRESENCE' | 'OPENED' | 'CLOSED' | 'DELETED';
}

/** Carries no votes; viewers reload the resolution. */
export const RESOLUTION_CHANGED = liveEvent<ResolutionChanged>('meetings.resolution-changed');

export interface ResolutionChanged {
  resolutionId: string;
  meetingId: string | null;
  change: 'CREATED' | 'OPENED' | 'VOTED' | 'CLOSED' | 'DELETED';
}

/** The club changed its meeting types; reload them. */
export const MEETING_TYPES_CHANGED = liveEvent<Record<string, never>>('meetings.meeting-types-changed');

/** The club changed its resolution rules; reload them. */
export const ACTION_RULES_CHANGED = liveEvent<Record<string, never>>('meetings.action-rules-changed');
