import { describe, expect, it } from 'vitest';
import type { Board, OrgChart, OrgPerson } from './MembersApi';
import { orgLayers, type OrgLabels } from './OrgChartModel.svelte';

const labels: OrgLabels = { office: (k) => k, isBoard: (k) => k !== 'AUDITOR', kind: (t) => t };
const person = (id: string, extra: Partial<OrgPerson> = {}): OrgPerson => ({
  id,
  name: id,
  membershipTypes: [],
  minor: false,
  login: null,
  roles: [],
  active: true,
  ...extra,
});
const chart: OrgChart = {
  teams: [
    {
      team: { id: 't1', name: 'U16', season: '2026/27' },
      entries: [
        { memberId: 'kid', name: 'kid', teamRole: 'PLAYER', jersey: 7, position: 'Zuspiel', captain: true },
        { memberId: 'chair', name: 'chair', teamRole: 'COACH' },
      ],
    },
  ],
  people: [
    person('kid', { minor: true, login: 'INVITED', roles: ['PLAYER'] }),
    person('chair', { roles: ['ADMIN', 'BOARD', 'COACH', 'PARENT'] }),
    person('loose', { roles: ['PLAYER'] }),
    person('gone', { roles: ['VOLUNTEER'], active: false }),
  ],
  guardians: [{ guardianId: 'chair', minorId: 'kid' }],
};
const board: Board = {
  offices: [
    {
      id: 'o1',
      memberId: 'chair',
      name: 'chair',
      office: 'CHAIR',
      startsOn: '2026-01-01',
      termEndsOn: '2029-01-01',
      coopted: false,
    } as Board['offices'][0],
  ],
  warnings: [],
};

describe('Organigramm layers', () => {
  it('puts a member with several roles into each layer and names the others', () => {
    const layers = orgLayers(chart, board, labels, true);
    expect(layers.map((l) => l.title)).toEqual(['Admin', 'Vorstand', 'Trainer:innen', 'Spieler:innen', 'Eltern', 'Helfer:innen']);
    const admin = layers[0].groups[0].cards[0];
    expect(admin.also).toEqual(['Vorstand', 'Trainer:innen', 'Eltern']);
    expect(layers[1].groups[0].cards[0].role).toBe('CHAIR');
    expect(layers[4].groups[0].cards[0].relatives).toEqual([{ id: 'kid', name: 'kid' }]);
  });

  it('splits coaches and players by team, with "Ohne Team" for managers only', () => {
    const [coaches, players] = orgLayers(chart, board, labels, true).filter((l) => l.byTeam);
    expect(coaches.groups.map((g) => g.title)).toEqual(['U16', 'Ohne Team']);
    expect(players.groups[0].cards[0].role).toBe('#7 · Zuspiel');
    expect(players.groups[0].cards[0].tags.map((t) => t.text)).toEqual(['Kapitän:in', 'minderjährig', 'Einladung offen']);
    expect(players.groups[1].cards.map((c) => c.memberId)).toEqual(['loose']);
    const coachView = orgLayers(chart, board, labels, false).filter((l) => l.byTeam);
    expect(coachView[1].groups.map((g) => g.title)).toEqual(['U16']);
  });

  it('counts deactivated accounts apart and keeps an empty Vorstand', () => {
    const volunteers = orgLayers(chart, board, labels, true).find((l) => l.key === 'volunteers')!;
    expect([volunteers.active, volunteers.inactive]).toEqual([0, 1]);
    expect(volunteers.groups[0].cards[0].tags[0].text).toBe('deaktiviert');
    expect(orgLayers({ teams: [], people: [], guardians: [] }, { offices: [], warnings: [] }, labels, true).map((l) => l.title)).toEqual([
      'Vorstand',
    ]);
  });
});
