// Seed data and stored shapes of the meetings mock (server: the meetings migrations' seeds and tables).
import type { LinkedRef } from '../../lib/records/refs';
import type { OfficeKind } from '../members/MembersApi';
import type { ActionRule, FollowUpKind, Majority, Meeting, MeetingStep, MeetingType, PresenceMode, Resolution, ResolutionAction } from './model';

const DAY = 86_400_000;

/** `inUse` is computed when listed. */
export type StoredType = MeetingType;
export const BOARD_OFFICES: OfficeKind[] = ['CHAIR', 'VICE_CHAIR', 'TREASURER', 'SECRETARY', 'BOARD_MEMBER'];
const CHAIRS: OfficeKind[] = ['CHAIR', 'VICE_CHAIR'];
export const ALL_MAJORITIES: Majority[] = ['SIMPLE', 'TWO_THIRDS', 'THREE_QUARTERS'];
/** server: V51__meeting_types.sql — the seeded kinds. */
export const SEEDED_TYPES: readonly StoredType[] = [
  { key: 'ASSEMBLY', label: 'Ordentliche Mitgliederversammlung', invitationLabel: 'ordentlichen Mitgliederversammlung',
    electorate: 'ASSEMBLY', noticeHours: 336, quorum: 'AT_LEAST_HALF', graceMinutes: 30, majorities: ALL_MAJORITIES, conveners: BOARD_OFFICES,
    actions: ['GENERAL', 'ELECTION'], needsReason: false, dueBy: '10-01', sort: 1, archived: false, inUse: false, steps: [] },
  { key: 'EXTRA_ASSEMBLY', label: 'Außerordentliche Mitgliederversammlung', invitationLabel: 'außerordentlichen Mitgliederversammlung',
    electorate: 'ASSEMBLY', noticeHours: 336, quorum: 'AT_LEAST_HALF', graceMinutes: 30, majorities: ALL_MAJORITIES,
    conveners: BOARD_OFFICES, actions: ['GENERAL', 'ELECTION', 'HONORARY_GRANT', 'HONORARY_REVOKE', 'STATUTES_CHANGE', 'DISSOLUTION'],
    needsReason: false, dueBy: null, sort: 2, archived: false, inUse: false, steps: [] },
  { key: 'BOARD', label: 'Ordentliche Vorstandssitzung', invitationLabel: 'ordentlichen Vorstandssitzung',
    electorate: 'BOARD', noticeHours: 336, quorum: 'MORE_THAN_HALF', graceMinutes: null, majorities: ['SIMPLE'], conveners: CHAIRS,
    actions: ['GENERAL', 'CONVENE_ASSEMBLY'], needsReason: false, dueBy: '10-01', sort: 3, archived: false, inUse: false, steps: [] },
  { key: 'EXTRA_BOARD', label: 'Außerordentliche Vorstandssitzung', invitationLabel: 'außerordentlichen Vorstandssitzung',
    electorate: 'BOARD', noticeHours: 48, quorum: 'AT_LEAST_THREE_QUARTERS', graceMinutes: null, majorities: ['THREE_QUARTERS'], conveners: CHAIRS,
    actions: ['GENERAL', 'EXCLUSION', 'CONVENE_ASSEMBLY'], needsReason: true, dueBy: null, sort: 4, archived: false, inUse: false, steps: [] },
  { key: 'SIMPLE_BOARD', label: 'Einfache Vorstandssitzung', invitationLabel: 'einfachen Vorstandssitzung',
    electorate: 'BOARD', noticeHours: 168, quorum: 'MORE_THAN_HALF', graceMinutes: null, majorities: ['SIMPLE'], conveners: BOARD_OFFICES,
    actions: ['GENERAL', 'CONVENE_ASSEMBLY'], needsReason: false, dueBy: null, sort: 5, archived: false, inUse: false, steps: [] },
  { key: 'CONSTITUENT_BOARD', label: 'Konstituierende Vorstandssitzung', invitationLabel: 'konstituierenden Vorstandssitzung',
    electorate: 'BOARD', noticeHours: 336, quorum: 'MORE_THAN_HALF', graceMinutes: null, majorities: ['SIMPLE'], conveners: CHAIRS,
    actions: ['GENERAL', 'CONVENE_ASSEMBLY'], needsReason: false, dueBy: null, sort: 6, archived: false, inUse: false, steps: [] },
];
/** server: V52__meeting_type_steps.sql and MeetingTypeHandlers.steps — the server's reminders (and, seeded, the protocol task). */
export function defaultSteps(seeded: boolean): MeetingStep[] {
  const id = () => crypto.randomUUID();
  return [
    { id: id(), anchor: 'BEFORE_INVITE', offsetHours: 72, action: 'NOTIFICATION', audience: 'BOARD', title: null, body: null, system: 'INVITE_REMINDER' },
    { id: id(), anchor: 'BEFORE_START', offsetHours: 24, action: 'NOTIFICATION', audience: 'ELECTORATE', title: null, body: null, system: 'START_REMINDER' },
    ...(seeded ? [{ id: id(), anchor: 'AFTER_END', offsetHours: 168, action: 'TASK', audience: 'SECRETARY', title: 'Protokoll fertigstellen: {titel}',
      body: 'Das Protokoll der Sitzung vom {datum} fertigstellen und ablegen.', system: null } as const] : []),
  ];
}
for (const t of SEEDED_TYPES) t.steps = defaultSteps(true);

/** server: V54__resolution_rules.sql */
export function seededRules(): ActionRule[] {
  const f = (kind: ActionRule['followUps'][number]['kind'], title: string, dueDays: number | null) => ({ id: crypto.randomUUID(), kind, title, dueDays });
  return [
    { action: 'GENERAL', majority: null, followUps: [f('IMPLEMENT', 'Beschluss umsetzen: {beschluss}', null)] },
    { action: 'HONORARY_GRANT', majority: null, followUps: [f('ENTER_HONORARY', 'Ehrenmitgliedschaft eintragen: {mitglied}', 7)] },
    { action: 'HONORARY_REVOKE', majority: null, followUps: [f('REVOKE_HONORARY', 'Ehrenmitgliedschaft aberkennen: {mitglied}', 7)] },
    { action: 'ELECTION', majority: null, followUps: [f('ENTER_OFFICE', 'Funktion eintragen: {funktion} – {mitglied}', 7)] },
    { action: 'STATUTES_CHANGE', majority: 'TWO_THIRDS', followUps: [] },
    { action: 'DISSOLUTION', majority: 'THREE_QUARTERS', followUps: [] },
    { action: 'EXCLUSION', majority: null, followUps: [f('NOTIFY_EXCLUSION', 'Ausschluss schriftlich mit Gründen mitteilen: {mitglied}', 7)] },
    { action: 'CONVENE_ASSEMBLY', majority: null, followUps: [f('CONVENE_ASSEMBLY', 'Außerordentliche Mitgliederversammlung einberufen', 7)] },
  ];
}
export type StoredMeeting = Omit<Meeting, 'latestInvite' | 'electorate' | 'present' | 'quorate' | 'canManage' | 'autoTasks' | 'followUps' | 'assignable'>
  & { presence: Record<string, PresenceMode>; autoTasks?: boolean; frozenElectorate?: string[] };
/** server: meetings_follow_up */
export type StoredFollowUp = { id: string; meetingId: string | null; resolutionId: string | null; kind: FollowUpKind; memberId: string | null;
  office: OfficeKind | null; title: string; dueAt: string | null; doneAt: string | null };
/** Counters hold what was voted, `ballots` only who voted (server: meetings_resolution, meetings_ballot). */
export type StoredResolution = Pick<Resolution, 'id' | 'meetingId' | 'title' | 'text' | 'majority' | 'status' | 'deadline' | 'voters' | 'analogYes'
  | 'analogNo' | 'analogAbstain' | 'result' | 'openedAt' | 'closedAt'> & { yes: number; no: number; abstain: number; ballots: string[];
  action?: ResolutionAction; actionMemberId?: string | null; actionOffice?: OfficeKind | null; assigneeIds?: string[]; frozenVoters?: string[];
  links?: LinkedRef[] };


/**
 * To try everything: a general meeting running now (quorate, two members without the app, one vote open), one to invite, an
 * invited board meeting, a closed board meeting with its protocol.
 */
export function seedMeetings(): StoredMeeting[] {
  const at = (days: number, hour: number) => {
    const d = new Date(Date.now() + days * DAY);
    d.setUTCHours(hour, 0, 0, 0);
    return d.toISOString();
  };
  const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
  const base = { urgency: null, videoUrl: null, openedAt: null, closedAt: null, protocol: null, presence: {}, links: [] };
  return [
    { ...base, id: 'mt-live', kind: 'EXTRA_ASSEMBLY', title: 'Außerordentliche Mitgliederversammlung',
      agenda: '1. Begrüßung und Beschlussfähigkeit\n2. Mitgliedsbeitrag 2027\n3. Statutenänderung: Mitgliedschaft\n4. Allfälliges',
      startsAt: ago(15), endsAt: ago(-105), location: 'Vereinsheim', videoUrl: 'https://meet.example.at/mv', status: 'OPEN',
      invitedAt: ago(20 * 24 * 60), openedAt: ago(10), protocol: '1. Begrüßung durch den Vorsitz, 8 von 12 Stimmberechtigten anwesend.',
      presence: { vorstand: 'APP', kassier: 'APP', schrift: 'APP', beisitz: 'APP', beisitz2: 'APP', admin: 'APP', eltern: 'ANALOG', ehren: 'ANALOG' },
      links: [
        { kind: 'MEMBER', id: 'kassier', title: 'Karin Kassier', parentId: null },
        { kind: 'MEETING', id: 'mt-past', title: 'Ordentliche Vorstandssitzung', parentId: null },
        { kind: 'TEAM', id: 't-damen', title: 'Damen 1', parentId: null },
      ] },
    { ...base, id: 'mt-past', kind: 'BOARD', title: 'Ordentliche Vorstandssitzung', agenda: '1. Jahresvoranschlag\n2. Hallenmiete Wintersaison',
      startsAt: at(-40, 17), endsAt: at(-40, 19), location: 'Vereinsheim', status: 'CLOSED', invitedAt: at(-60, 9), openedAt: at(-40, 17),
      closedAt: at(-40, 19), protocol: '1. Jahresvoranschlag besprochen und angenommen.\n2. Hallenmiete: siehe Beschluss.',
      presence: { vorstand: 'APP', kassier: 'APP', schrift: 'APP', beisitz: 'APP', beisitz2: 'ANALOG' } },
    { ...base, id: 'mt-mv', kind: 'ASSEMBLY', title: 'Ordentliche Mitgliederversammlung', agenda: '1. Begrüßung\n2. Bericht des Vorstands\n3. Rechnungsabschluss\n4. Mitgliedsbeiträge',
      startsAt: at(30, 17), endsAt: at(30, 19), location: 'Vereinsheim', status: 'DRAFT', invitedAt: null },
    { ...base, id: 'mt-vs', kind: 'SIMPLE_BOARD', title: 'Vorstandssitzung', agenda: '1. Hallenzeiten\n2. Aufnahmeanträge',
      startsAt: at(10, 18), endsAt: at(10, 19), location: null, videoUrl: 'https://meet.example.at/vorstand', status: 'INVITED', invitedAt: new Date().toISOString() },
  ];
}

export function seedResolutions(): StoredResolution[] {
  const now = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();
  const base = { text: null, deadline: null, analogYes: null, analogNo: null, analogAbstain: null, result: null, openedAt: null, closedAt: null };
  return [
    { ...base, id: 'rs-beitrag', meetingId: 'mt-live', title: 'Mitgliedsbeitrag 2027: 60 €', text: 'Der Vorstand schlägt 60 € pro Jahr vor (bisher 50 €).',
      majority: 'SIMPLE', status: 'OPEN', voters: 12, openedAt: iso(now - 5 * 60_000), yes: 1, no: 1, abstain: 0, ballots: ['kassier', 'schrift'] },
    { ...base, id: 'rs-statuten', meetingId: 'mt-live', title: 'Statutenänderung: Mitgliedschaft', text: 'Ordentliche Mitglieder dürfen auch passiv teilnehmen.',
      majority: 'TWO_THIRDS', status: 'DRAFT', voters: null, yes: 0, no: 0, abstain: 0, ballots: [] },
    { ...base, id: 'rs-halle', meetingId: 'mt-past', title: 'Hallenmiete Wintersaison: 1.800 €', majority: 'SIMPLE', status: 'CLOSED', voters: 5,
      openedAt: iso(now - 40 * DAY), closedAt: iso(now - 40 * DAY + 600_000), result: 'PASSED', analogYes: 1, analogNo: 0, analogAbstain: 0,
      yes: 3, no: 0, abstain: 1, ballots: ['vorstand', 'kassier', 'schrift', 'beisitz'] },
    { ...base, id: 'rs-baelle', meetingId: null, title: 'Zehn neue Bälle um 400 €', text: 'Die alten Bälle sind abgenutzt; Angebot im Ordner Vorstand.',
      majority: 'SIMPLE', status: 'OPEN', voters: 5, deadline: iso(now + 4 * DAY), openedAt: iso(now - DAY), yes: 1, no: 0, abstain: 0, ballots: ['kassier'] },
  ];
}
