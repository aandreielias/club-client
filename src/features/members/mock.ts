// Member admin endpoints of the mock server (rules live in MockDirectory, like the server's MemberHandlers).
import { directory } from '../../lib/mock/core';
import { mockServer } from '../../lib/mock/MockServer';

mockServer
  .on('POST', '/api/v1/members/security/reset-all', (req) => directory.resetAllSecurity(directory.actor(req), req.body?.confirm))
  .on('POST', '/api/v1/members', (req) => directory.invite(directory.actor(req), req.body ?? {}))
  .on('GET', '/api/v1/members/:id', (req) => directory.get(directory.actor(req), req.params.id))
  .on('PUT', '/api/v1/members/:id/roles', (req) => directory.setRoles(directory.actor(req), req.params.id, req.body?.roles))
  .on('POST', '/api/v1/members/:id/deactivate', (req) => directory.deactivate(directory.actor(req), req.params.id))
  .on('POST', '/api/v1/members/:id/guardians', (req) => directory.linkGuardian(directory.actor(req), req.params.id, req.body?.guardianId))
  .on('POST', '/api/v1/members/:id/security/reset', (req) => directory.resetSecurity(directory.actor(req), req.params.id));
