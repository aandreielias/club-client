// Team admin endpoints of the mock server (rules live in MockDirectory, like the server's TeamHandlers).
import { directory } from '../../lib/mock/core';
import { mockServer } from '../../lib/mock/MockServer';
import { calendar } from '../calendar/mock';
import { files } from '../files/mock';
import { tasks } from '../tasks/mock';

const teamInUse = (teamId: string): boolean =>
  calendar.appointments.data.some((a) => a.teamId === teamId) ||
  tasks.tasks.data.some((t) => t.teamId === teamId) ||
  files.folders.data.some((f) => f.teamIds.includes(teamId));

mockServer
  .on('POST', '/api/v1/teams', (req) => directory.createTeam(directory.actor(req), req.body ?? {}))
  .on('PATCH', '/api/v1/teams/:id', (req) => directory.updateTeam(directory.actor(req), req.params.id, req.body ?? {}))
  .on('DELETE', '/api/v1/teams/:id', (req) => directory.deleteTeam(directory.actor(req), req.params.id, teamInUse(req.params.id)))
  .on('PUT', '/api/v1/teams/:id/members/:memberId', (req) =>
    directory.setTeamMember(directory.actor(req), req.params.id, req.params.memberId, req.body?.teamRole))
  .on('DELETE', '/api/v1/teams/:id/members/:memberId', (req) =>
    directory.removeTeamMember(directory.actor(req), req.params.id, req.params.memberId));
