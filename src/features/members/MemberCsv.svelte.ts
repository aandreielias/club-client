import { ROLE_LABELS, type Member, type Role } from '../../lib/types';
import { HONORARY, SEEDED_MEMBERSHIP_KINDS } from './MembersApi';

/** Kind key → label (the club's kinds; default: the seeded ones). */
export type MembershipLabels = Readonly<Record<string, string>>;
const SEEDED_LABELS: MembershipLabels = Object.fromEntries(SEEDED_MEMBERSHIP_KINDS.map((k) => [k.key, k.label]));
import { InviteForm, type MemberField } from './MemberForms.svelte';
import type { Invitation, Membership, MembersApi } from './MembersApi';

/** Columns of the member CSV; the export writes all, the import reads all but "Status". */
const HEADER = [
  'Vorname',
  'Zweiter Vorname',
  'Nachname',
  'E-Mail',
  'Geburtsdatum',
  'Telefon',
  'Fotoeinwilligung',
  'Rollen',
  'Mitgliedschaft',
  'Ehrenmitglied',
  'Mitglied seit',
  'Status',
] as const;
/** Read by the import only: who the guardian is (their e-mail, a member or a line of the same file) and the teams (names). */
type ImportOnly = 'Erziehungsberechtigte:r' | 'Teams';
type Column = (typeof HEADER)[number] | ImportOnly;
const REQUIRED: readonly Column[] = ['Vorname', 'Nachname', 'E-Mail', 'Geburtsdatum'];
const FIELD_COLUMNS: Readonly<Record<MemberField, Column>> = {
  email: 'E-Mail',
  firstName: 'Vorname',
  middleName: 'Zweiter Vorname',
  lastName: 'Nachname',
  birthDate: 'Geburtsdatum',
  phone: 'Telefon',
  roles: 'Rollen',
  membershipType: 'Mitgliedschaft',
};

/** One valid import line: the invitation, plus membership values the invitation cannot carry. */
export interface ImportRow {
  line: number;
  invitation: Invitation;
  /** Set after the invitation when honorary or an earlier "Mitglied seit" is given. */
  membership: Membership | null;
  /** The guardian's e-mail, linked once every account exists. */
  guardianEmail: string | null;
  /** Team names the member joins as player. */
  teams: string[];
}

export interface ImportProblem {
  line: number;
  text: string;
}

export interface ParsedImport {
  rows: ImportRow[];
  problems: ImportProblem[];
}

const yesNo = (value: boolean): string => (value ? 'ja' : 'nein');

function cell(value: string): string {
  // Leading = + - @ would run as a formula in Excel (CSV injection).
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[";\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** Semicolon CSV with BOM, as German Excel opens and saves it. */
export function membersToCsv(members: readonly Member[], labels: MembershipLabels = SEEDED_LABELS): string {
  const lines = members.map((m) =>
    [
      m.firstName,
      m.middleName ?? '',
      m.lastName,
      m.email ?? '',
      m.birthDate ?? '',
      m.phone ?? '',
      yesNo(m.photoConsent),
      m.roles.map((r) => ROLE_LABELS[r]).join(', '),
      // an honorary member's former kind (one kind per member) goes into the column, so an import restores both
      (m.membershipTypes.some((t) => t !== HONORARY) ? m.membershipTypes.filter((t) => t !== HONORARY) : m.previousType ? [m.previousType] : [])
        .map((t) => labels[t] ?? t)
        .join(', '),
      yesNo(m.membershipTypes.includes(HONORARY)),
      m.memberSince ?? '',
      m.active ? 'Aktiv' : 'Inaktiv',
    ]
      .map(cell)
      .join(';'),
  );
  return `\uFEFF${[HEADER.join(';'), ...lines].join('\r\n')}\r\n`;
}

/** RFC 4180 records with the given separator; quoted cells may hold separators, quotes and line breaks. */
export function parseCsv(text: string, separator: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        value += '"';
        i++;
      } else if (c === '"') quoted = false;
      else value += c;
    } else if (c === '"') quoted = true;
    else if (c === separator) {
      record.push(value);
      value = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      record.push(value);
      records.push(record);
      record = [];
      value = '';
    } else value += c;
  }
  if (value || record.length) records.push([...record, value]);
  return records;
}

/** ISO or German date (Excel turns 2010-05-03 into 03.05.2010). */
function isoDate(value: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const german = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value);
  return german ? `${german[3]}-${german[2].padStart(2, '0')}-${german[1].padStart(2, '0')}` : null;
}

function byLabel<K extends string>(labels: Readonly<Record<K, string>>, value: string): K | null {
  const v = value.trim().toLowerCase();
  return (Object.keys(labels) as K[]).find((k) => k.toLowerCase() === v || labels[k].toLowerCase() === v) ?? null;
}

/**
 * Reads new accounts from a member CSV (the export format; column order free, "Status" ignored).
 * E-mails already in `existing` or earlier in the file, and roles the importer may not grant, are problems.
 */
export function parseMemberImport(
  text: string,
  today: string,
  existing: ReadonlySet<string>,
  grantable: readonly Role[],
  labels: MembershipLabels = SEEDED_LABELS,
  multipleKinds = false,
): ParsedImport {
  const body = text.replace(/^\uFEFF/, '');
  const first = body.split(/\r?\n/, 1)[0];
  const records = parseCsv(body, first.split(';').length >= first.split(',').length ? ';' : ',');
  const header = (records.shift() ?? []).map((h) => h.trim());
  const missing = REQUIRED.filter((c) => !header.includes(c));
  if (missing.length) return { rows: [], problems: [{ line: 1, text: `Spalten fehlen: ${missing.join(', ')}.` }] };

  const rows: ImportRow[] = [];
  const problems: ImportProblem[] = [];
  const seen = new Set(existing);
  records.forEach((record, index) => {
    const line = index + 2;
    if (record.every((v) => !v.trim())) return;
    // Undo the export's formula guard ('+43 …).
    const get = (column: Column): string => (record[header.indexOf(column)] ?? '').trim().replace(/^'(?=[=+\-@])/, '');
    const fail = (text: string) => problems.push({ line, text });

    const form = new InviteForm(today);
    form.firstName = get('Vorname');
    form.middleName = header.includes('Zweiter Vorname') ? get('Zweiter Vorname') : '';
    form.lastName = get('Nachname');
    form.email = get('E-Mail');
    form.phone = get('Telefon');
    form.photoConsent = get('Fotoeinwilligung').toLowerCase() === 'ja';

    const birth = get('Geburtsdatum');
    const birthDate = birth ? isoDate(birth) : '';
    if (birthDate === null) return fail(`Geburtsdatum "${birth}" nicht lesbar (JJJJ-MM-TT oder TT.MM.JJJJ).`);
    form.birthDate = birthDate;

    const since = get('Mitglied seit');
    const memberSince = since ? isoDate(since) : null;
    if (since && !memberSince) return fail(`"Mitglied seit" "${since}" nicht lesbar.`);

    const roleCells = get('Rollen')
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);
    const roles = roleCells.map((r) => byLabel(ROLE_LABELS, r));
    const badRole = roleCells.find((r, i) => !roles[i] || !grantable.includes(roles[i]));
    if (badRole) return fail(`Rolle "${badRole}" unbekannt oder nicht vergebbar.`);
    form.roles = roles as Role[];

    const type = get('Mitgliedschaft');
    const membershipType = type ? byLabel(labels, type) : null;
    if (type && !membershipType) return fail(`Mitgliedschaft "${type}" unbekannt.`);
    form.membershipType = membershipType ?? 'NONE';

    const invalid = Object.entries(form.errors);
    if (invalid.length) return fail(invalid.map(([field, text]) => `${FIELD_COLUMNS[field as MemberField]}: ${text}`).join(' '));

    const invitation = form.toInvitation();
    if (invitation.email) {
      if (seen.has(invitation.email)) return fail(`${invitation.email} gibt es schon.`);
      seen.add(invitation.email);
    }

    const honorary = get('Ehrenmitglied').toLowerCase() === 'ja';
    // With one kind per member, the honour replaces the invited kind (the server remembers it for a revoke).
    const own = invitation.membershipType ? [invitation.membershipType] : [];
    const membershipTypes = !honorary ? own : multipleKinds ? [...own, HONORARY] : [HONORARY];
    const membership = honorary || memberSince ? { membershipTypes, memberSince: memberSince ?? today } : null;
    const guardianEmail = get('Erziehungsberechtigte:r').toLowerCase() || null;
    const teams = get('Teams')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    rows.push({ line, invitation, membership, guardianEmail, teams });
  });
  return { rows, problems };
}

/** What the import links after the accounts exist: members already there by e-mail, the club's teams. */
export interface ImportLinks {
  existing: ReadonlyMap<string, string>;
  teams: readonly { id: string; name: string }[];
  setTeam: (teamId: string, memberId: string) => Promise<unknown>;
}

/** The server allows 60 writes a minute per member: the import keeps below, and waits when it is told to slow down. */
const PAUSE_MS = 1100;
const SLOW_DOWN_MS = 30_000;

/**
 * Creates the accounts one by one (each sends its invitation e-mail), then links guardians and teams; a failed line does not stop the
 * rest. `wait` is the pause between requests (tests pass a no-op).
 */
export async function runMemberImport(
  api: MembersApi,
  rows: readonly ImportRow[],
  describe: (error: unknown) => string,
  links: ImportLinks | null = null,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<ImportProblem[]> {
  const problems: ImportProblem[] = [];
  /** One request, again once after a "too many requests". */
  const call = async <T>(request: () => Promise<T>): Promise<T> => {
    await wait(PAUSE_MS);
    try {
      return await request();
    } catch (error) {
      if ((error as { status?: number })?.status !== 429) throw error;
      await wait(SLOW_DOWN_MS);
      return request();
    }
  };
  // By e-mail (guardians are found by it); members without one by their line.
  const created = new Map<string, string>();
  const key = (row: ImportRow) => row.invitation.email ?? `line:${row.line}`;
  for (const row of rows) {
    let done = false;
    try {
      const member = await call(() => api.invite(row.invitation));
      done = true;
      created.set(key(row), member.id);
      if (row.membership) await call(() => api.setMembership(member.id, row.membership!));
    } catch (error) {
      problems.push({ line: row.line, text: done ? `Konto angelegt, Mitgliedschaft nicht gesetzt: ${describe(error)}` : describe(error) });
    }
  }
  if (!links) return problems;
  for (const row of rows) {
    const memberId = created.get(key(row));
    if (!memberId) continue;
    try {
      if (row.guardianEmail) {
        const guardian = created.get(row.guardianEmail) ?? links.existing.get(row.guardianEmail);
        if (!guardian) problems.push({ line: row.line, text: `Erziehungsberechtigte:r ${row.guardianEmail} nicht gefunden.` });
        else await call(() => api.linkGuardian(memberId, guardian));
      }
      for (const name of row.teams) {
        const team = links.teams.find((t) => t.name.toLocaleLowerCase() === name.toLocaleLowerCase());
        if (!team) problems.push({ line: row.line, text: `Team „${name}“ nicht gefunden.` });
        else await call(() => links.setTeam(team.id, memberId));
      }
    } catch (error) {
      problems.push({ line: row.line, text: `Konto angelegt, nicht verknüpft: ${describe(error)}` });
    }
  }
  return problems;
}
