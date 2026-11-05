// Team admin endpoints of the mock server (server: TeamHandlers); the team tables stay on the directory, which every mock reads.
import { directory, type MockDirectory } from '../../lib/mock/core';
import { MockServer, mockServer } from '../../lib/mock/MockServer';
import { ADMIN_BOARD, coaches, type Member, type Roster, type Team, type TeamRole } from '../../lib/types';
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
    const archivedBefore = !!team.archived;
    Object.assign(team, { name, season });
    if (typeof body.archived === 'boolean') team.archived = body.archived;
    this.people.teams.save();
    // server: archiving ends a season, so coaches without another active team lose an automatic COACH role
    if (!!team.archived !== archivedBefore) for (const member of this.people.teamMembers(teamId)) this.people.membershipChanged(teamId, member);
    return team;
  }

  /** server: TeamHandlers.delete; `inUse` stands in for the foreign keys of appointments, tasks and folders. */
  deleteTeam(viewer: Member, teamId: string, inUse: boolean): void {
    this.people.requirePrivileged(viewer, ADMIN_BOARD);
    const index = this.people.teams.data.findIndex((t) => t.id === teamId);
    if (index < 0) fail(404, 'team.not-found');
    if (inUse) fail(409, 'team.in-use');
    const former = this.people.teamMembers(teamId);
    this.people.teams.data.splice(index, 1);
    for (const roles of Object.values(this.people.memberships.data)) delete roles[teamId];
    this.people.teams.save();
    this.people.memberships.save();
    for (const member of former) this.people.membershipChanged(teamId, member);
  }

  /** Admin/board only; a coach of the team gets 403, everyone else 404. Also changes the role of existing members. */
  setTeamMember(viewer: Member, teamId: string, memberId: string, teamRole: unknown): Roster {
    if (!this.people.teams.data.some((t) => t.id === teamId)) fail(404, 'team.not-found');
    // Not coaches: membership would let them read any member's birth date and contact data.
    if (!this.people.isManager(viewer)) {
      if (coaches(this.people.teamRoles(viewer.id)[teamId])) fail(403, 'access.denied');
      fail(404, 'team.not-found');
    }
    if (teamRole !== 'COACH' && teamRole !== 'ASSISTANT' && teamRole !== 'PLAYER') fail(400, 'request.invalid');
    if (!this.people.name(memberId)) fail(404, 'member.not-found');
    (this.people.memberships.data[memberId] ??= {})[teamId] = teamRole as TeamRole;
    this.people.memberships.save();
    this.people.membershipChanged(teamId, memberId);
    return this.people.roster(viewer, teamId);
  }

  /** server: TeamHandlers.requireRunsTeam — admin/board, or a coach of the team. */
  private requireRunsTeam(viewer: Member, teamId: string): void {
    if (this.people.isManager(viewer)) return;
    if (!coaches(this.people.teamRoles(viewer.id)[teamId])) fail(404, 'team.not-found');
  }

  /** server: TeamHandlers.setPlayerInfo — one captain per team. */
  setPlayerInfo(viewer: Member, teamId: string, memberId: string, body: Record<string, any>): Roster {
    if (!this.people.teams.data.some((t) => t.id === teamId)) fail(404, 'team.not-found');
    this.requireRunsTeam(viewer, teamId);
    if (!(teamId in this.people.teamRoles(memberId))) fail(404, 'member.not-found');
    const jersey = body.jersey ?? null;
    const position = typeof body.position === 'string' && body.position.trim() ? body.position.trim() : null;
    if ((jersey !== null && (!Number.isInteger(jersey) || jersey < 0 || jersey > 99)) || (position?.length ?? 0) > 40)
      fail(400, 'team.player-info-invalid');
    const infos = (this.people.playerInfo.data[teamId] ??= {});
    if (body.captain) for (const info of Object.values(infos)) info.captain = false;
    infos[memberId] = { jersey, position, captain: !!body.captain };
    this.people.playerInfo.save();
    this.people.membershipChanged(teamId, memberId);
    return this.people.roster(viewer, teamId);
  }

  /** server: TeamHandlers.copy — next season with the same roster. */
  copyTeam(viewer: Member, teamId: string, body: Record<string, any>): Team {
    this.people.requirePrivileged(viewer, ADMIN_BOARD);
    const from = this.people.teams.data.find((t) => t.id === teamId) ?? fail(404, 'team.not-found');
    const copy = this.createTeam(viewer, { name: typeof body.name === 'string' && body.name.trim() ? body.name : from.name, season: body.season });
    for (const memberId of this.people.teamMembers(teamId)) {
      (this.people.memberships.data[memberId] ??= {})[copy.id] = this.people.teamRoles(memberId)[teamId];
      const info = this.people.playerInfo.data[teamId]?.[memberId];
      if (info) (this.people.playerInfo.data[copy.id] ??= {})[memberId] = { ...info };
    }
    this.people.memberships.save();
    this.people.playerInfo.save();
    return copy;
  }

  /** server: TeamHandlers.requestPlayer — to admin and board. */
  requestPlayer(viewer: Member, teamId: string, body: Record<string, any>): void {
    const team = this.people.teams.data.find((t) => t.id === teamId) ?? fail(404, 'team.not-found');
    if (!coaches(this.people.teamRoles(viewer.id)[teamId])) fail(404, 'team.not-found');
    const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null;
    const player = body.memberId ? this.people.name(body.memberId) : null;
    if ((body.memberId && !player) || (!player && !note) || (note?.length ?? 0) > 500) fail(400, 'team.request-invalid');
    mockServer.events.publish({
      type: 'teams.player-requested',
      data: {
        teamId,
        team: `${team.name} ${team.season}`,
        coach: this.people.name(viewer.id),
        player,
        note,
        recipients: this.people.audienceIds({ roles: ADMIN_BOARD }),
      },
    });
  }

  /** Admin/board remove anyone; a coach of the team removes players only. */
  removeTeamMember(viewer: Member, teamId: string, memberId: string): Roster {
    if (!this.people.teams.data.some((t) => t.id === teamId)) fail(404, 'team.not-found');
    if (!this.people.isManager(viewer)) {
      this.requireRunsTeam(viewer, teamId);
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
  .on('PUT', '/api/v1/teams/:id/members/:memberId/info', (req) =>
    teams.setPlayerInfo(directory.actor(req), req.params.id, req.params.memberId, req.body ?? {}),
  )
  .on('POST', '/api/v1/teams/:id/copy', (req) => teams.copyTeam(directory.actor(req), req.params.id, req.body ?? {}))
  .on('POST', '/api/v1/teams/:id/player-requests', (req) => teams.requestPlayer(directory.actor(req), req.params.id, req.body ?? {}))
  .on('DELETE', '/api/v1/teams/:id/members/:memberId', (req) => teams.removeTeamMember(directory.actor(req), req.params.id, req.params.memberId));
