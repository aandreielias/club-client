import { Resource } from '../../lib/state/Resource.svelte';
import { TEAM_ROLE_LABELS, type MembershipType, type Role, type TeamRole } from '../../lib/types';
import type { Board, LoginState, MembersApi, OfficeKind, OrgChart, OrgPerson } from './MembersApi';

export interface OrgTag {
  text: string;
  tone?: 'orange' | 'blue';
}

/** One person in one layer: `role` is the line above the name, `also` the other layers, `relatives` the children of a parent. */
export interface OrgCard {
  key: string;
  memberId: string;
  name: string;
  role: string | null;
  tags: OrgTag[];
  also: string[];
  relatives: { id: string; name: string }[];
  active: boolean;
}

/** A cell of a layer: the whole row, or one team (coaches above their players). */
export interface OrgGroup {
  key: string;
  title: string | null;
  subtitle: string | null;
  cards: OrgCard[];
}

export interface OrgLayer {
  key: string;
  title: string;
  byTeam: boolean;
  /** Distinct people, active and deactivated. */
  active: number;
  inactive: number;
  groups: OrgGroup[];
}

export interface OrgLabels {
  office(kind: OfficeKind): string;
  isBoard(kind: OfficeKind): boolean;
  kind(type: MembershipType): string;
}

const LOGIN_TAGS: Record<LoginState, OrgTag | null> = {
  SIGNED_IN: null,
  INVITED: { text: 'Einladung offen', tone: 'orange' },
  NONE: { text: 'Kein Login' },
};
const RANK: Record<TeamRole, number> = { COACH: 0, ASSISTANT: 1, PLAYER: 2 };
const NO_TEAM = 'none';

/**
 * Layers by role (Admin, Vorstand, functions, Trainer:innen, Spieler:innen, Eltern, Helfer:innen, Gäste, without role). A member with
 * several roles has a card in each layer, so every count is the number of accounts with that role. Coaches and players are split by
 * team, in the same columns; `manager` adds the "Ohne Team" column for role holders outside every team (coaches only see their teams).
 */
export function orgLayers(chart: OrgChart, board: Board, labels: OrgLabels, manager: boolean): OrgLayer[] {
  const people = new Map(chart.people.map((p) => [p.id, p]));
  const has = (role: Role) => chart.people.filter((p) => p.roles.includes(role));
  const nameOf = (id: string) => people.get(id)?.name ?? chart.teams.flatMap((t) => t.entries).find((e) => e.memberId === id)?.name ?? '';
  const tags = (p: OrgPerson | undefined): OrgTag[] =>
    !p
      ? []
      : [
          ...(p.active ? [] : [{ text: 'deaktiviert' }]),
          ...p.membershipTypes.map((t) => ({ text: labels.kind(t) })),
          ...(p.minor ? [{ text: 'minderjährig' }] : []),
          ...(p.active && p.login && LOGIN_TAGS[p.login] ? [LOGIN_TAGS[p.login]!] : []),
        ];
  const card = (key: string, memberId: string, role: string | null, extra: OrgTag[] = [], name = nameOf(memberId)): OrgCard => ({
    key,
    memberId,
    name,
    role,
    tags: [...extra, ...tags(people.get(memberId))],
    also: [],
    relatives: [],
    active: people.get(memberId)?.active ?? true,
  });
  const flat = (key: string, title: string, cards: OrgCard[]): OrgLayer => layer(key, title, false, [{ key, title: null, subtitle: null, cards }]);

  // Teams: the coaches' and the players' layer share the columns.
  const inTeam = (coach: boolean) =>
    chart.teams.map(({ team, entries }) => ({
      key: team.id,
      title: team.name,
      subtitle: team.season,
      cards: entries
        .filter((e) => (e.teamRole !== 'PLAYER') === coach)
        .sort((a, b) => RANK[a.teamRole] - RANK[b.teamRole] || a.name.localeCompare(b.name))
        .map((e) =>
          card(
            `${team.id}/${e.memberId}`,
            e.memberId,
            [coach ? TEAM_ROLE_LABELS[e.teamRole] : null, e.jersey != null ? `#${e.jersey}` : null, e.position].filter(Boolean).join(' · ') || null,
            e.captain ? [{ text: 'Kapitän:in', tone: 'orange' }] : [],
          ),
        ),
    }));
  const outside = (role: Role, groups: OrgGroup[]): OrgGroup => {
    const placed = new Set(groups.flatMap((g) => g.cards.map((c) => c.memberId)));
    return {
      key: NO_TEAM,
      title: 'Ohne Team',
      subtitle: null,
      cards: manager
        ? has(role)
            .filter((p) => !placed.has(p.id))
            .map((p) => card(`${NO_TEAM}/${p.id}`, p.id, null))
        : [],
    };
  };
  const coachTeams = inTeam(true);
  const playerTeams = inTeam(false);
  const coaches = [...coachTeams, outside('COACH', coachTeams)];
  const players = [...playerTeams, outside('PLAYER', playerTeams)];
  if (!coaches.at(-1)!.cards.length && !players.at(-1)!.cards.length) [coaches, players].forEach((g) => g.pop());

  // Parents: the PARENT role and everyone linked as guardian, each with their children.
  const parentIds = [...new Set([...has('PARENT').map((p) => p.id), ...chart.guardians.map((l) => l.guardianId)])];
  const parents = parentIds
    .map((id) => ({
      ...card(id, id, null),
      relatives: chart.guardians.filter((l) => l.guardianId === id).map((l) => ({ id: l.minorId, name: nameOf(l.minorId) })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const offices = (onBoard: boolean) =>
    board.offices.filter((o) => labels.isBoard(o.office) === onBoard).map((o) => card(o.id, o.memberId, labels.office(o.office), [], o.name));
  const flatCards = (role: Role) => has(role).map((p) => card(p.id, p.id, null));
  const layers = [
    flat('admin', 'Admin', flatCards('ADMIN')),
    // Vorstand by office (known club-wide), plus BOARD holders without one
    flat('board', 'Vorstand', [
      ...offices(true),
      ...has('BOARD')
        .filter((p) => !board.offices.some((o) => o.memberId === p.id))
        .map((p) => card(p.id, p.id, null)),
    ]),
    flat('offices', 'Weitere Funktionen', offices(false)),
    layer('coaches', 'Trainer:innen', true, coaches),
    layer('players', 'Spieler:innen', true, players),
    flat('parents', 'Eltern', parents),
    flat('volunteers', 'Helfer:innen', flatCards('VOLUNTEER')),
    flat('guests', 'Gäste', flatCards('GUEST')),
    flat(
      'none',
      'Ohne Rolle',
      manager ? chart.people.filter((p) => !p.roles.length && !parentIds.includes(p.id)).map((p) => card(p.id, p.id, null)) : [],
    ),
  ].filter((l) => l.key === 'board' || l.active + l.inactive);

  // Same person in other layers: "auch: …".
  const layersOf = new Map<string, string[]>();
  for (const l of layers)
    for (const id of new Set(l.groups.flatMap((g) => g.cards.map((c) => c.memberId)))) layersOf.set(id, [...(layersOf.get(id) ?? []), l.title]);
  for (const l of layers) for (const g of l.groups) for (const c of g.cards) c.also = (layersOf.get(c.memberId) ?? []).filter((t) => t !== l.title);
  return layers;
}

function layer(key: string, title: string, byTeam: boolean, groups: OrgGroup[]): OrgLayer {
  const byId = new Map(groups.flatMap((g) => g.cards.map((c) => [c.memberId, c.active] as const)));
  const active = [...byId.values()].filter(Boolean).length;
  return { key, title, byTeam, active, inactive: byId.size - active, groups };
}

/** The Organigramm: the chart (scoped by the server) and the running offices, read together. */
export class OrgChartModel {
  readonly data: Resource<{ chart: OrgChart; board: Board }>;

  constructor(private readonly api: MembersApi) {
    this.data = new Resource(async () => {
      const [chart, board] = await Promise.all([this.api.orgChart(), this.api.board()]);
      return { chart, board };
    });
  }

  load(): Promise<void> {
    return this.data.load();
  }
}
