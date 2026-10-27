// Team admin endpoints of the mock server (server: TeamHandlers); the team tables stay on the directory, which every mock reads.
import { directory, type MockDirectory } from '../../lib/mock/core';
import { MockServer, mockServer } from '../../lib/mock/MockServer';
import { ADMIN_BOARD, type Member, type Roster, type Team, type TeamRole } from '../../lib/types';
import { settings } from '../../settings';
import { calendar } from '../calendar/mock';
import { files } from '../files/mock';
import { tasks } from '../tasks/mock';

const teamInUse = (teamId: string): boolean =>
  calendar.appointments.data.some((a) => a.teamId === teamId) ||
  tasks.tasks.data.some((t) => t.teamId === teamId) ||
  files.folders.data.some((f) => f.teamIds.includes(teamId));

const fail = MockServer.fail;

/** server: TeamHandlers */
export class MockTeams {
  constructor(private readonly people: MockDirectory) {}

  createTeam(viewer: Member, body: Record<string, unknown>): Team {
    this.people.requirePrivileged(viewer, ADMIN_BOARD);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > settings.teams.nameMaxLength) fail(400, 'team.name-invalid');
    if (typeof body.season !== 'string' || !new RegExp(settings.teams.seasonPattern).test(body.season)) fail(400, 'team.season-invalid');
    if (this.people.teams.data.some((t) => t.name === name && t.season === body.season)) fail(409, 'team.exists');
    const team: Team = { id: crypto.randomUUID(), name, season: body.season as string };
    this.people.teams.data.push(team);
    this.people.teams.save();
    return team;
  }

  /** server: TeamHandlers.update; name and season, unique per season. */
  updateTeam(viewer: Member, teamId: string, body: Record<string, unknown>): Team {
    this.people.requirePrivileged(viewer, ADMIN_BOARD);
    const team = this.people.teams.data.find((t) => t.id === teamId) ?? fail(404, 'team.not-found');
    const name = typeof body.name === 'string' ? body.name.trim() : team.name;
    const season = typeof body.season === 'string' ? body.season : team.season;
    if (!name || name.length > settings.teams.nameMaxLength) fail(400, 'team.name-invalid');
    if (!new RegExp(settings.teams.seasonPattern).test(season)) fail(400, 'team.season-invalid');
    if (this.people.teams.data.some((t) => t.id !== teamId && t.name.toLowerCase() === name.toLowerCase() && t.season === season))
      fail(409, 'team.exists');
    Object.assign(team, { name, season });
    this.people.teams.save();
    return team;
  }

  /** server: TeamHandlers.delete; `inUse` stands in for the foreign keys of appointments, tasks and folders. */
  deleteTeam(viewer: Member, teamId: string, inUse: boolean): void {
    this.people.requirePrivileged(viewer, ADMIN_BOARD);
    const index = this.people.teams.data.findIndex((t) => t.id === teamId);
    if (index < 0) fail(404, 'team.not-found');
    if (inUse) fail(409, 'team.in-use');
    this.people.teams.data.splice(index, 1);
    for (const roles of Object.values(this.people.memberships.data)) delete roles[teamId];
    this.people.teams.save();
    this.people.memberships.save();
  }

  /** Admin/board only; a coach of the team gets 403, everyone else 404. Also changes the role of existing members. */
  setTeamMember(viewer: Member, teamId: string, memberId: string, teamRole: unknown): Roster {
    if (!this.people.teams.data.some((t) => t.id === teamId)) fail(404, 'team.not-found');
    // Not coaches: membership would let them read any member's birth date and contact data.
    if (!this.people.isManager(viewer)) {
      if (this.people.teamRoles(viewer.id)[teamId] === 'COACH') fail(403, 'access.denied');
      fail(404, 'team.not-found');
    }
    this.people.requirePrivileged(viewer, ADMIN_BOARD);
    if (teamRole !== 'COACH' && teamRole !== 'PLAYER') fail(400, 'request.invalid');
    if (!this.people.name(memberId)) fail(404, 'member.not-found');
    (this.people.memberships.data[memberId] ??= {})[teamId] = teamRole as TeamRole;
    this.people.memberships.save();
    this.people.membershipChanged(teamId, memberId);
    return this.people.roster(viewer, teamId);
  }

  /** Admin/board remove anyone; a coach of the team removes players only. */
  removeTeamMember(viewer: Member, teamId: string, memberId: string): Roster {
    if (!this.people.teams.data.some((t) => t.id === teamId)) fail(404, 'team.not-found');
    if (this.people.isManager(viewer)) {
      this.people.requirePrivileged(viewer, ADMIN_BOARD);
    } else {
      if (this.people.teamRoles(viewer.id)[teamId] !== 'COACH') fail(404, 'team.not-found');
      this.people.requirePrivileged(viewer, ['COACH']);
      if ((this.people.teamRoles(memberId)[teamId] ?? 'PLAYER') !== 'PLAYER') fail(403, 'access.denied');
    }
    this.people.removeFromTeamUnchecked(teamId, memberId);
    return this.people.roster(viewer, teamId);
  }
}

export const teams = new MockTeams(directory);

mockServer
  .on('POST', '/api/v1/teams', (req) => teams.createTeam(directory.actor(req), req.body ?? {}))
  .on('PATCH', '/api/v1/teams/:id', (req) => teams.updateTeam(directory.actor(req), req.params.id, req.body ?? {}))
  .on('DELETE', '/api/v1/teams/:id', (req) => teams.deleteTeam(directory.actor(req), req.params.id, teamInUse(req.params.id)))
  .on('PUT', '/api/v1/teams/:id/members/:memberId', (req) =>
    teams.setTeamMember(directory.actor(req), req.params.id, req.params.memberId, req.body?.teamRole),
  )
  .on('DELETE', '/api/v1/teams/:id/members/:memberId', (req) => teams.removeTeamMember(directory.actor(req), req.params.id, req.params.memberId));
