// Team admin endpoints of the mock server (rules live in MockDirectory, like the server's TeamHandlers).
import { directory } from '../../lib/mock/core';
import { mockServer } from '../../lib/mock/MockServer';

mockServer
  .on('POST', '/api/v1/teams', (req) => directory.createTeam(directory.actor(req), req.body ?? {}))
  .on('PUT', '/api/v1/teams/:id/members/:memberId', (req) =>
    directory.setTeamMember(directory.actor(req), req.params.id, req.params.memberId, req.body?.teamRole))
  .on('DELETE', '/api/v1/teams/:id/members/:memberId', (req) =>
    directory.removeTeamMember(directory.actor(req), req.params.id, req.params.memberId));
