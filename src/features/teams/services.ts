import { api, permissions, session } from '../../lib/container';
import { TeamPolicy } from './TeamPolicy';
import { TeamsApi } from './TeamsApi';

/** Team services, created once and shared by the team pages. */
export const teamsApi = new TeamsApi(api);
export const teamPolicy = new TeamPolicy(session, permissions);
