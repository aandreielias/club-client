import { api, bus, session, store, windows } from '../../lib/container';
import { CallService } from './CallService.svelte';
import { MeetingPolicy } from './MeetingPolicy';
import { MeetingsApi } from './MeetingsApi';
import { MeetingTypesStore } from './MeetingTypesStore.svelte';
import { ResolutionRulesStore } from './ResolutionRulesStore.svelte';

/** Meeting services, created once and shared by the meeting pages. */
export const meetingsApi = new MeetingsApi(api);
export const meetingPolicy = new MeetingPolicy(session);
export const meetingTypes = new MeetingTypesStore(meetingsApi, bus);
export const resolutionRules = new ResolutionRulesStore(meetingsApi, bus);
/** The video call the member is in, app-wide. */
export const calls = new CallService(meetingsApi, windows, store);
