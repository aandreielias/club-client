import { AuditApi, type AuditKind } from '../../lib/audit/AuditApi';
import { ListModel } from '../../lib/list/ListModel.svelte';
import { Action } from '../../lib/state/Action.svelte';
import type { LocalStore } from '../../lib/storage/LocalStore';
import type { Formatter } from '../../lib/time/Formatter';
import type { AuditEntry } from '../../lib/types';

export const AUDIT_KINDS: Readonly<Record<AuditKind, string>> = { READ: 'Angesehen', WRITE: 'Geändert', EXPORT: 'Datenexport' };

/** API areas (first path segment) and how the Protokoll names them. */
export const AUDIT_AREAS: Readonly<Record<string, string>> = {
  members: 'Mitglieder',
  'membership-kinds': 'Mitgliedsarten',
  board: 'Vorstand',
  club: 'Verein',
  teams: 'Teams',
  appointments: 'Termine',
  calendar: 'Kalender',
  absences: 'Abwesenheiten',
  rides: 'Fahrgemeinschaften',
  tasks: 'Aufgaben',
  files: 'Dateien',
  folders: 'Ordner',
  inventory: 'Inventar',
  locations: 'Orte',
  meetings: 'Sitzungen',
  resolutions: 'Beschlüsse',
  notifications: 'Nachrichten',
  tournaments: 'Turniere',
  me: 'Eigenes Konto',
};

const ACTIONS: Readonly<Record<string, string>> = {
  GET: 'angesehen',
  HEAD: 'angesehen',
  POST: 'angelegt',
  PUT: 'geändert',
  PATCH: 'geändert',
  DELETE: 'gelöscht',
};

function kindOf(e: AuditEntry): AuditKind {
  if (e.route === '/api/v1/me/export') return 'EXPORT';
  return e.method === 'GET' || e.method === 'HEAD' ? 'READ' : 'WRITE';
}

export function areaOf(e: AuditEntry): string {
  return e.route.split('/')[3] ?? '';
}

/** Path words after the area; others are shown as they are. */
const WORDS: Readonly<Record<string, string>> = {
  roles: 'Rollen',
  membership: 'Mitgliedschaft',
  family: 'Familie',
  guardians: 'Erziehungsberechtigte',
  invite: 'Einladung',
  invitations: 'Einladungen',
  email: 'E-Mail',
  erase: 'Löschung',
  deactivate: 'Deaktivierung',
  reactivate: 'Reaktivierung',
  'change-requests': 'Änderungsanträge',
  approve: 'Annahme',
  reject: 'Ablehnung',
  'org-chart': 'Organigramm',
  offices: 'Funktionen',
  settings: 'Einstellungen',
  end: 'Ende',
  export: 'Datenexport',
};

/** Path variables that hold a member id. */
const MEMBER_PARAMS = new Set(['memberId', 'guardianId', 'minorId']);

/** "Anna Muster › Rollen" for members/{id}/roles: the area is its own column, member ids become names, other ids are shortened. */
export function auditWhat(e: AuditEntry, nameOf: (memberId: string) => string | null = () => null): string {
  const [, , , area, ...rest] = e.route.split('/');
  const parts = rest.map((segment) => {
    const param = /^\{(\w+)\}$/.exec(segment)?.[1];
    if (!param) return WORDS[segment] ?? segment;
    const value = e.params[param] ?? param;
    const member = MEMBER_PARAMS.has(param) || (area === 'members' && param === 'id');
    return (member ? nameOf(value) : null) ?? value.slice(0, 8);
  });
  return parts.join(' › ') || 'Liste';
}

export function auditAction(e: AuditEntry): string {
  return kindOf(e) === 'EXPORT' ? 'Daten exportiert' : (ACTIONS[e.method] ?? e.method);
}

/**
 * Einstellungen › Protokoll (admin): kind, area and person filter on the server, so they reach the whole log; the search looks
 * through the loaded entries (names, areas, ids). Older pages on demand.
 */
export class AuditListModel extends ListModel<AuditEntry> {
  readonly more = new Action();
  #query: { kind: AuditKind | null; area: string | null; actorId: string | null } = { kind: null, area: null, actorId: null };
  #page = 0;
  hasMore = $state(false);

  constructor(
    private readonly api: AuditApi,
    format: () => Formatter,
    store: LocalStore | null,
    nameOf: (memberId: string) => string | null = () => null,
  ) {
    super(
      {
        id: 'audit',
        load: async (server) => {
          this.#query = { kind: (server.kind || null) as AuditKind | null, area: server.area || null, actorId: server.actor || null };
          this.#page++;
          const page = await api.list(this.#query);
          this.hasMore = page.nextBefore !== null;
          return page.items;
        },
        defaultSort: { key: 'at', dir: 'desc' },
        searchText: (e) =>
          `${e.actorName ?? 'Gelöschtes Mitglied'} ${AUDIT_AREAS[areaOf(e)] ?? ''} ${auditAction(e)} ${auditWhat(e, nameOf)} ${Object.values(e.params).join(' ')}`,
        columns: [
          { key: 'at', label: 'Wann', value: (e) => e.at, format: (e) => format().dateTime(e.at), width: '10rem' },
          { key: 'actor', label: 'Wer', value: (e) => e.actorName ?? 'Gelöschtes Mitglied', width: '12rem' },
          { key: 'action', label: 'Aktion', value: (e) => auditAction(e), width: '9rem' },
          { key: 'area', label: 'Bereich', value: (e) => AUDIT_AREAS[areaOf(e)] ?? areaOf(e), width: '9rem', hideOnCompact: true },
          { key: 'what', label: 'Was', value: (e) => auditWhat(e, nameOf) },
        ],
        filters: [
          {
            key: 'kind',
            label: 'Art',
            kind: 'select',
            allLabel: 'Alle Arten',
            options: () => Object.entries(AUDIT_KINDS).map(([value, label]) => ({ value, label })),
          },
          {
            key: 'area',
            label: 'Bereich',
            kind: 'select',
            allLabel: 'Alle Bereiche',
            options: () => Object.entries(AUDIT_AREAS).map(([value, label]) => ({ value, label })),
          },
          {
            key: 'actor',
            label: 'Person',
            kind: 'select',
            allLabel: 'Alle Personen',
            transient: true,
            // The people of the loaded entries (and the chosen one, which stays among them).
            options: (items) =>
              [...new Map(items.map((e) => [e.actorId, e.actorName ?? 'Gelöschtes Mitglied'])).entries()]
                .map(([value, label]) => ({ value, label }))
                .sort((a, b) => a.label.localeCompare(b.label)),
          },
        ],
      },
      store,
    );
  }

  /** Appends the next older page with the same filters. */
  loadMore(): Promise<boolean> {
    return this.more.run(async () => {
      const last = this.data.value?.at(-1);
      if (!last) return;
      const started = this.#page;
      const page = await this.api.list({ ...this.#query, before: last.id });
      if (started !== this.#page) return;
      this.hasMore = page.nextBefore !== null;
      this.set([...(this.data.value ?? []), ...page.items]);
    });
  }
}
