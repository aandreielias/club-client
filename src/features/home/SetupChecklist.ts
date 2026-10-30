/** What the start page knows about a new club's setup (admin only); each fact comes from its own feature. */
export interface SetupFacts {
  /** Active members with the ADMIN role. */
  admins: number;
  /** The viewer set up the authenticator app (admins and board confirm with it). */
  authenticator: boolean;
  mailDomain: boolean;
  /** Running offices on the board page. */
  offices: number;
  teams: number;
  locations: number;
  folders: number;
  /** Where the statutes live (Einstellungen › Beschlüsse). */
  statutes: boolean;
  /** Active members who are not admins. */
  members: number;
  /** Seeded settings have no "empty" state: a step counts once the admin opened it from the card. */
  visited: ReadonlySet<string>;
}

export interface SetupStep {
  id: string;
  label: string;
  /** Why it matters, shown while open. */
  detail: string;
  href: string;
  done: boolean;
  /** Open and risky: shown in red. */
  warn?: boolean;
}

/** The steps of a new club, in a sensible order. */
export function setupSteps(f: SetupFacts): SetupStep[] {
  const seen = (id: string) => f.visited.has(id);
  return [
    {
      id: 'admins',
      label: 'Zweiten Admin einladen',
      detail: 'Fällt der einzige Admin aus, kommt niemand mehr an Einstellungen und Rollen.',
      href: '#/members',
      done: f.admins >= 2,
      warn: f.admins < 2,
    },
    {
      id: 'authenticator',
      label: 'Authenticator-App einrichten',
      detail: 'Admins und Vorstand bestätigen heikle Änderungen damit.',
      href: '#/settings/security',
      done: f.authenticator,
    },
    {
      id: 'membership',
      label: 'Mitgliedsarten prüfen',
      detail: 'Wer stimmberechtigt und wählbar ist.',
      href: '#/settings/membership',
      done: seen('membership'),
    },
    {
      id: 'offices',
      label: 'Funktionen prüfen und Vorstand eintragen',
      detail: 'Funktionen unter Einstellungen; wer sie innehat, auf der Seite Vorstand.',
      href: f.offices ? '#/board' : '#/settings/offices',
      done: f.offices > 0,
    },
    {
      id: 'mail',
      label: 'Mail-Domain festlegen',
      detail: 'Jedes Mitglied bekommt damit eine Vereinsadresse.',
      href: '#/settings/mailboxes',
      done: f.mailDomain,
    },
    { id: 'teams', label: 'Teams anlegen', detail: 'Termine, Kader und Nachrichten hängen an Teams.', href: '#/teams', done: f.teams > 0 },
    { id: 'locations', label: 'Orte anlegen', detail: 'Plätze und Hallen für Termine.', href: '#/locations', done: f.locations > 0 },
    {
      id: 'files',
      label: 'Ordner und Statuten-Ablage',
      detail: 'Ordner für Dokumente, darin die Statuten (Einstellungen › Beschlüsse).',
      href: f.folders ? '#/settings/resolution-rules' : '#/files',
      done: f.folders > 0 && f.statutes,
    },
    {
      id: 'meeting-types',
      label: 'Sitzungsarten prüfen',
      detail: 'Fristen, Beschlussfähigkeit und wer einberuft.',
      href: '#/settings/meeting-types',
      done: seen('meeting-types'),
    },
    { id: 'members', label: 'Mitglieder einladen', detail: 'Einzeln oder per CSV-Import.', href: '#/members', done: f.members > 0 },
  ];
}
