import { ROLE_LABELS, type Member, type Role } from '../../lib/types';
import { HONORARY, SEEDED_MEMBERSHIP_KINDS } from './MembersApi';

/** Kind key → label (the club's kinds; default: the seeded ones). */
export type MembershipLabels = Readonly<Record<string, string>>;
const SEEDED_LABELS: MembershipLabels = Object.fromEntries(SEEDED_MEMBERSHIP_KINDS.map((k) => [k.key, k.label]));
import { InviteForm, type MemberField } from './MemberForms.svelte';
import type { Invitation, Membership, MembersApi } from './MembersApi';

/** Columns of the member CSV; the export writes all, the import reads all but "Status". */
const HEADER = ['Vorname', 'Nachname', 'E-Mail', 'Geburtsdatum', 'Telefon', 'Fotoeinwilligung', 'Rollen', 'Mitgliedschaft', 'Ehrenmitglied', 'Mitglied seit', 'Status'] as const;
type Column = (typeof HEADER)[number];
const REQUIRED: readonly Column[] = ['Vorname', 'Nachname', 'E-Mail'];
const FIELD_COLUMNS: Readonly<Record<MemberField, Column>> = { email: 'E-Mail', firstName: 'Vorname', lastName: 'Nachname', birthDate: 'Geburtsdatum', phone: 'Telefon', roles: 'Rollen' };

/** One valid import line: the invitation, plus membership values the invitation cannot carry. */
export interface ImportRow {
  line: number;
  invitation: Invitation;
  /** Set after the invitation when honorary or an earlier "Mitglied seit" is given. */
  membership: Membership | null;
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
      m.lastName,
      m.email,
      m.birthDate ?? '',
      m.phone ?? '',
      yesNo(m.photoConsent),
      m.roles.map((r) => ROLE_LABELS[r]).join(', '),
      // an honorary member's former kind (one kind per member) goes into the column, so an import restores both
      (m.membershipTypes.some((t) => t !== HONORARY) ? m.membershipTypes.filter((t) => t !== HONORARY) : m.previousType ? [m.previousType] : [])
        .map((t) => labels[t] ?? t).join(', '),
      yesNo(m.membershipTypes.includes(HONORARY)),
      m.memberSince ?? '',
      m.active ? 'Aktiv' : 'Inaktiv',
    ]
      .map(cell)
      .join(';'),
  );
  return `﻿${[HEADER.join(';'), ...lines].join('\r\n')}\r\n`;
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
      if (c === '"' && text[i + 1] === '"') (value += '"'), i++;
      else if (c === '"') quoted = false;
      else value += c;
    } else if (c === '"') quoted = true;
    else if (c === separator) record.push(value), (value = '');
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      record.push(value);
      records.push(record);
      (record = []), (value = '');
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
export function parseMemberImport(text: string, today: string, existing: ReadonlySet<string>, grantable: readonly Role[],
  labels: MembershipLabels = SEEDED_LABELS, multipleKinds = false): ParsedImport {
  const body = text.replace(/^﻿/, '');
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

    const roleCells = get('Rollen').split(',').map((r) => r.trim()).filter(Boolean);
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
    if (seen.has(invitation.email)) return fail(`${invitation.email} gibt es schon.`);
    seen.add(invitation.email);

    const honorary = get('Ehrenmitglied').toLowerCase() === 'ja';
    // With one kind per member, the honour replaces the invited kind (the server remembers it for a revoke).
    const own = invitation.membershipType ? [invitation.membershipType] : [];
    const membershipTypes = !honorary ? own : multipleKinds ? [...own, HONORARY] : [HONORARY];
    const membership = honorary || memberSince ? { membershipTypes, memberSince: memberSince ?? today } : null;
    rows.push({ line, invitation, membership });
  });
  return { rows, problems };
}

/** Creates the accounts one by one (each sends its invitation e-mail); a failed line does not stop the rest. */
export async function runMemberImport(api: MembersApi, rows: readonly ImportRow[], describe: (error: unknown) => string): Promise<ImportProblem[]> {
  const problems: ImportProblem[] = [];
  for (const row of rows) {
    let created = false;
    try {
      const member = await api.invite(row.invitation);
      created = true;
      if (row.membership) await api.setMembership(member.id, row.membership);
    } catch (error) {
      problems.push({ line: row.line, text: created ? `Konto angelegt, Mitgliedschaft nicht gesetzt: ${describe(error)}` : describe(error) });
    }
  }
  return problems;
}
