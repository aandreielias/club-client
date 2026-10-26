import { api, bus, session } from '../../lib/container';
import { MeetingPolicy } from './MeetingPolicy';
import { MeetingsApi } from './MeetingsApi';
import { MeetingTypesStore } from './MeetingTypesStore.svelte';
import { ResolutionRulesStore } from './ResolutionRulesStore.svelte';

/** Meeting services, created once and shared by the meeting pages. */
export const meetingsApi = new MeetingsApi(api);
export const meetingPolicy = new MeetingPolicy(session);
export const meetingTypes = new MeetingTypesStore(meetingsApi, bus);
export const resolutionRules = new ResolutionRulesStore(meetingsApi, bus);
