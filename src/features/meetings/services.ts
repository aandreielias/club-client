import { api, session } from '../../lib/container';
import { MeetingPolicy } from './MeetingPolicy';
import { MeetingsApi } from './MeetingsApi';

/** Meeting services, created once and shared by the meeting pages. */
export const meetingsApi = new MeetingsApi(api);
export const meetingPolicy = new MeetingPolicy(session);
