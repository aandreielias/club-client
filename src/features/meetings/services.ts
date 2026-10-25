import { api, bus, session } from '../../lib/container';
import { MeetingPolicy } from './MeetingPolicy';
import { MeetingsApi } from './MeetingsApi';
import { MeetingTypes } from './MeetingTypes.svelte';

/** Meeting services, created once and shared by the meeting pages. */
export const meetingsApi = new MeetingsApi(api);
export const meetingPolicy = new MeetingPolicy(session);
export const meetingTypes = new MeetingTypes(meetingsApi, bus);
