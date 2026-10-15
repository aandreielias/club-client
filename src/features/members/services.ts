import { api, session } from '../../lib/container';
import { MemberPolicy } from './MemberPolicy';
import { MembersApi } from './MembersApi';

/** Member administration services, created once and shared by the member pages. */
export const membersApi = new MembersApi(api);
export const memberPolicy = new MemberPolicy(session);
