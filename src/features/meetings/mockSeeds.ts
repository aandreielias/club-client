// Seed data and stored shapes of the meetings mock (server: the meetings migrations' seeds and tables).
import type { LinkedRef } from '../../lib/records/refs';
import type { OfficeKind } from '../members/MembersApi';
import {
  type AgendaItem,
  type Approval,
  type Majority,
  type Meeting,
  type MeetingStep,
  type MeetingType,
  type Resolution,
  type VoteMode,
} from './model';

const DAY = 86_400_000;

/** `inUse` is computed when listed. */
export type StoredType = MeetingType;
export const BOARD_OFFICES: OfficeKind[] = ['CHAIR', 'VICE_CHAIR', 'TREASURER', 'SECRETARY', 'BOARD_MEMBER'];
const CHAIRS: OfficeKind[] = ['CHAIR', 'VICE_CHAIR'];
export const ALL_MAJORITIES: Majority[] = ['SIMPLE', 'TWO_THIRDS', 'THREE_QUARTERS'];
/** server: V51__meeting_types.sql — the seeded kinds. */
export const SEEDED_TYPES: readonly StoredType[] = [
  {
    key: 'ASSEMBLY',
    label: 'Ordentliche Mitgliederversammlung',
    invitationLabel: 'ordentlichen Mitgliederversammlung',
    invitees: 'VOTERS',
    voting: 'ALL_INVITED',
    minInvitees: null,
    maxInvitees: null,
    noticeHours: 336,
    quorum: 'AT_LEAST_HALF',
    graceMinutes: 30,
    majorities: ALL_MAJORITIES,
    conveners: BOARD_OFFICES,
    needsReason: false,
    dueBy: '10-01',
    sort: 1,
    archived: false,
    online: false,
    videoUrl: null,
    inUse: false,
    steps: [],
  },
  {
    key: 'EXTRA_ASSEMBLY',
    label: 'Außerordentliche Mitgliederversammlung',
    invitationLabel: 'außerordentlichen Mitgliederversammlung',
    invitees: 'VOTERS',
    voting: 'ALL_INVITED',
    minInvitees: null,
    maxInvitees: null,
    noticeHours: 336,
    quorum: 'AT_LEAST_HALF',
    graceMinutes: 30,
    majorities: ALL_MAJORITIES,
    conveners: BOARD_OFFICES,
    needsReason: false,
    dueBy: null,
    sort: 2,
    archived: false,
    online: true,
    videoUrl: 'https://meet.example.at/mv',
    inUse: false,
    steps: [],
  },
  {
    key: 'BOARD',
    label: 'Ordentliche Vorstandssitzung',
    invitationLabel: 'ordentlichen Vorstandssitzung',
    invitees: 'BOARD',
    voting: 'ALL_INVITED',
    minInvitees: null,
    maxInvitees: null,
    noticeHours: 336,
    quorum: 'MORE_THAN_HALF',
    graceMinutes: null,
    majorities: ['SIMPLE'],
    conveners: CHAIRS,
    needsReason: false,
    dueBy: '10-01',
    sort: 3,
    archived: false,
    online: false,
    videoUrl: null,
    inUse: false,
    steps: [],
  },
  {
    key: 'EXTRA_BOARD',
    label: 'Außerordentliche Vorstandssitzung',
    invitationLabel: 'außerordentlichen Vorstandssitzung',
    invitees: 'BOARD',
    voting: 'ALL_INVITED',
    minInvitees: null,
    maxInvitees: null,
    noticeHours: 48,
    quorum: 'AT_LEAST_THREE_QUARTERS',
    graceMinutes: null,
    majorities: ['THREE_QUARTERS'],
    conveners: CHAIRS,
    needsReason: true,
    dueBy: null,
    sort: 4,
    archived: false,
    online: false,
    videoUrl: null,
    inUse: false,
    steps: [],
  },
  {
    key: 'SIMPLE_BOARD',
    label: 'Einfache Vorstandssitzung',
    invitationLabel: 'einfachen Vorstandssitzung',
    invitees: 'BOARD',
    voting: 'ALL_INVITED',
    minInvitees: null,
    maxInvitees: null,
    noticeHours: 168,
    quorum: 'MORE_THAN_HALF',
    graceMinutes: null,
    majorities: ['SIMPLE'],
    conveners: BOARD_OFFICES,
    needsReason: false,
    dueBy: null,
    sort: 5,
    archived: false,
    online: true,
    videoUrl: 'https://meet.example.at/vorstand',
    inUse: false,
    steps: [],
  },
  {
    key: 'CONSTITUENT_BOARD',
    label: 'Konstituierende Vorstandssitzung',
    invitationLabel: 'konstituierenden Vorstandssitzung',
    invitees: 'BOARD',
    voting: 'ALL_INVITED',
    minInvitees: null,
    maxInvitees: null,
    noticeHours: 336,
    quorum: 'MORE_THAN_HALF',
    graceMinutes: null,
    majorities: ['SIMPLE'],
    conveners: CHAIRS,
    needsReason: false,
    dueBy: null,
    sort: 6,
    archived: false,
    online: false,
    videoUrl: null,
    inUse: false,
    steps: [],
  },
];
/** server: V52__meeting_type_steps.sql and MeetingTypeHandlers.steps — the server's reminders (and, seeded, the protocol task). */
export function defaultSteps(seeded: boolean): MeetingStep[] {
  const id = () => crypto.randomUUID();
  return [
    {
      id: id(),
      anchor: 'BEFORE_INVITE',
      offsetHours: 72,
      action: 'NOTIFICATION',
      audience: 'BOARD',
      title: null,
      body: null,
      system: 'INVITE_REMINDER',
      office: null,
    },
    {
      id: id(),
      anchor: 'BEFORE_START',
      offsetHours: 24,
      action: 'NOTIFICATION',
      audience: 'ELECTORATE',
      title: null,
      body: null,
      system: 'START_REMINDER',
      office: null,
    },
    ...(seeded
      ? [
          {
            id: id(),
            anchor: 'AFTER_END',
            offsetHours: 168,
            action: 'TASK',
            audience: 'SECRETARY',
            title: 'Protokoll fertigstellen: {titel}',
            body: 'Das Protokoll der Sitzung vom {datum} fertigstellen und ablegen.',
            system: null,
            office: null,
          } as const,
        ]
      : []),
  ];
}
for (const t of SEEDED_TYPES) t.steps = defaultSteps(true);

/** server: V116__arbitration.sql — the Schlichtungseinrichtung: three chosen people, all present, deadlines from the Anrufung. */
const step = (
  anchor: MeetingStep['anchor'],
  offsetHours: number,
  action: MeetingStep['action'],
  audience: MeetingStep['audience'],
  office: string | null,
  title: string | null,
  body: string | null,
  system: MeetingStep['system'] = null,
): MeetingStep => ({ id: crypto.randomUUID(), anchor, offsetHours, action, audience, office, title, body, system });
(SEEDED_TYPES as StoredType[]).push({
  key: 'SCHLICHTUNG',
  label: 'Schlichtungseinrichtung',
  invitationLabel: 'Sitzung der Schlichtungseinrichtung',
  invitees: 'CHOSEN',
  voting: 'ALL_INVITED',
  minInvitees: 3,
  maxInvitees: 3,
  noticeHours: 168,
  quorum: 'ALL',
  graceMinutes: null,
  majorities: ['SIMPLE'],
  conveners: ['AUDITOR', 'CHAIR', 'VICE_CHAIR'],
  needsReason: false,
  dueBy: null,
  sort: 20,
  archived: false,
  online: false,
  videoUrl: null,
  selfCheckIn: false,
  inUse: false,
  steps: [
    step(
      'AFTER_CREATE',
      0,
      'TASK',
      'CONVENERS',
      null,
      'Streitparteien zur Namhaftmachung auffordern: {titel}',
      'Beide Streitparteien schriftlich auffordern, binnen 14 Tagen je ein Mitglied für die Schlichtungseinrichtung zu nennen.',
    ),
    step(
      'AFTER_CREATE',
      336,
      'TASK',
      'CONVENERS',
      null,
      'Namhaftmachung prüfen: {titel}',
      'Haben beide Streitparteien ein Mitglied genannt? Sonst eine Nachfrist von 14 Tagen setzen.',
    ),
    step(
      'AFTER_CREATE',
      672,
      'TASK',
      'OFFICE',
      'AUDITOR',
      'Fehlende Namhaftmachung vornehmen: {titel}',
      'Hat eine Streitpartei nach der Nachfrist niemanden genannt, nennen die Rechnungsprüfer das fehlende Mitglied.',
    ),
    step(
      'AFTER_CREATE',
      1008,
      'TASK',
      'OFFICE',
      'AUDITOR',
      'Vorsitz der Schlichtungseinrichtung: {titel}',
      'Haben die beiden Mitglieder binnen 14 Tagen einen Vorsitz gewählt? Sonst bestimmen ihn die Rechnungsprüfer.',
    ),
    step(
      'AFTER_CREATE',
      4392,
      'NOTIFICATION',
      'CONVENERS',
      null,
      'Sechs Monate seit Anrufung: {titel}',
      'Seit der Anrufung der Schlichtungseinrichtung sind sechs Monate vergangen; der ordentliche Rechtsweg steht offen.',
    ),
    step('BEFORE_START', 24, 'NOTIFICATION', 'ELECTORATE', null, null, null, 'START_REMINDER'),
    step(
      'AFTER_END',
      168,
      'TASK',
      'CONVENERS',
      null,
      'Entscheidung schriftlich ausfertigen: {titel}',
      'Die Entscheidung der Schlichtungseinrichtung vom {datum} schriftlich festhalten und den Streitparteien zustellen.',
    ),
  ],
});

export type StoredMeeting = Omit<
  Meeting,
  | 'online'
  | 'latestInvite'
  | 'electorate'
  | 'present'
  | 'quorate'
  | 'canManage'
  | 'protocolFinalAt'
  | 'agendaItems'
  | 'approvals'
  | 'chair'
  | 'secretary'
  | 'chosen'
> & {
  /** Voters marked Anwesend. */
  presence: Record<string, true>;
  frozenElectorate?: string[];
  createdBy?: string;
  protocolFinalAt?: string | null;
  agendaItems?: AgendaItem[];
  approvals?: Approval[];
  /** server: meetings_meeting.chair_id / secretary_id */
  chairId?: string | null;
  secretaryId?: string | null;
  /** server: meetings_meeting.created_at (the Anrufung of an arbitration). */
  createdAt?: string;
  /** CHOSEN types (server: meetings_invitee, meetings_guest, meetings_party). */
  invitees?: string[];
  guests?: { id: string; name: string; email: string }[];
  parties?: string[];
};
/** Counters hold what was voted, `ballots` only who voted (server: meetings_resolution, meetings_ballot). */
export type StoredResolution = Pick<
  Resolution,
  | 'id'
  | 'meetingId'
  | 'title'
  | 'text'
  | 'majority'
  | 'status'
  | 'deadline'
  | 'voters'
  | 'analogYes'
  | 'analogNo'
  | 'analogAbstain'
  | 'result'
  | 'openedAt'
  | 'closedAt'
> & {
  yes: number;
  no: number;
  abstain: number;
  ballots: string[];
  /** server: meetings_resolution.vote_mode */
  voteMode?: VoteMode | null;
  assigneeIds?: string[];
  /** server: meetings_resolution.implement_due */
  implementDue?: string | null;
  frozenVoters?: string[];
  createdBy?: string;
  links?: LinkedRef[];
};

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
    {
      ...base,
      id: 'mt-live',
      kind: 'EXTRA_ASSEMBLY',
      title: 'Außerordentliche Mitgliederversammlung',
      agenda: '1. Begrüßung und Beschlussfähigkeit\n2. Mitgliedsbeitrag 2027\n3. Statutenänderung: Mitgliedschaft\n4. Allfälliges',
      startsAt: ago(15),
      endsAt: ago(-105),
      location: 'Vereinsheim',
      videoUrl: 'https://meet.example.at/mv',
      status: 'OPEN',
      invitedAt: ago(20 * 24 * 60),
      openedAt: ago(10),
      protocol: '1. Begrüßung durch den Vorsitz, 8 von 12 Stimmberechtigten anwesend.',
      presence: { vorstand: true, kassier: true, schrift: true, beisitz: true, beisitz2: true, admin: true, eltern: true, ehren: true },
      links: [
        { kind: 'MEMBER', id: 'kassier', title: 'Karin Kassier', parentId: null },
        { kind: 'MEETING', id: 'mt-past', title: 'Ordentliche Vorstandssitzung', parentId: null },
        { kind: 'TEAM', id: 't-damen', title: 'Damen 1', parentId: null },
      ],
    },
    {
      ...base,
      id: 'mt-past',
      kind: 'BOARD',
      title: 'Ordentliche Vorstandssitzung',
      agenda: '1. Jahresvoranschlag\n2. Hallenmiete Wintersaison',
      startsAt: at(-40, 17),
      endsAt: at(-40, 19),
      location: 'Vereinsheim',
      status: 'CLOSED',
      invitedAt: at(-60, 9),
      openedAt: at(-40, 17),
      closedAt: at(-40, 19),
      protocolFinalAt: at(-40, 19),
      protocol: '1. Jahresvoranschlag besprochen und angenommen.\n2. Hallenmiete: siehe Beschluss.',
      presence: { vorstand: true, kassier: true, schrift: true, beisitz: true, beisitz2: true },
    },
    {
      ...base,
      id: 'mt-mv',
      kind: 'ASSEMBLY',
      title: 'Ordentliche Mitgliederversammlung',
      agenda: '1. Begrüßung\n2. Bericht des Vorstands\n3. Rechnungsabschluss\n4. Mitgliedsbeiträge',
      startsAt: at(30, 17),
      endsAt: at(30, 19),
      location: 'Vereinsheim',
      status: 'DRAFT',
      invitedAt: null,
    },
    {
      ...base,
      id: 'mt-vs',
      kind: 'SIMPLE_BOARD',
      title: 'Vorstandssitzung',
      agenda: '1. Hallenzeiten\n2. Aufnahmeanträge',
      startsAt: at(10, 18),
      endsAt: at(10, 19),
      location: null,
      videoUrl: 'https://meet.example.at/vorstand',
      status: 'INVITED',
      invitedAt: new Date().toISOString(),
    },
    {
      ...base,
      id: 'mt-schlichtung',
      kind: 'SCHLICHTUNG',
      title: 'Schlichtung: Hallenzeiten Damen / Herren',
      agenda: '1. Anhörung der Streitparteien\n2. Entscheidung',
      startsAt: at(35, 18),
      endsAt: at(35, 20),
      location: 'Vereinsheim',
      status: 'DRAFT',
      invitedAt: null,
      createdAt: ago(3 * 24 * 60),
      // One member and one guest named so far; the third is still missing (exactly three before the invitation).
      invitees: ['ehren'],
      guests: [{ id: 'guest-huber', name: 'Dr. Maria Huber', email: 'maria.huber@example.at' }],
      parties: ['trainer', 'spielerin'],
    },
  ];
}

export function seedResolutions(): StoredResolution[] {
  const now = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();
  const base = { text: null, deadline: null, analogYes: null, analogNo: null, analogAbstain: null, result: null, openedAt: null, closedAt: null };
  return [
    {
      ...base,
      id: 'rs-beitrag',
      meetingId: 'mt-live',
      title: 'Mitgliedsbeitrag 2027: 60 €',
      text: 'Der Vorstand schlägt 60 € pro Jahr vor (bisher 50 €).',
      majority: 'SIMPLE',
      status: 'OPEN',
      voteMode: 'APP',
      voters: 12,
      openedAt: iso(now - 5 * 60_000),
      yes: 1,
      no: 1,
      abstain: 0,
      ballots: ['kassier', 'schrift'],
    },
    {
      ...base,
      id: 'rs-statuten',
      meetingId: 'mt-live',
      title: 'Statutenänderung: Mitgliedschaft',
      text: 'Ordentliche Mitglieder dürfen auch passiv teilnehmen.',
      majority: 'TWO_THIRDS',
      status: 'DRAFT',
      voters: null,
      yes: 0,
      no: 0,
      abstain: 0,
      ballots: [],
    },
    {
      ...base,
      id: 'rs-halle',
      meetingId: 'mt-past',
      title: 'Hallenmiete Wintersaison: 1.800 €',
      majority: 'SIMPLE',
      status: 'CLOSED',
      voters: 5,
      openedAt: iso(now - 40 * DAY),
      closedAt: iso(now - 40 * DAY + 600_000),
      result: 'PASSED',
      voteMode: 'HAND',
      analogYes: 4,
      analogNo: 0,
      analogAbstain: 1,
      yes: 0,
      no: 0,
      abstain: 0,
      ballots: ['vorstand', 'kassier', 'schrift', 'beisitz'],
    },
    {
      ...base,
      id: 'rs-baelle',
      meetingId: null,
      title: 'Zehn neue Bälle um 400 €',
      text: 'Die alten Bälle sind abgenutzt; Angebot im Ordner Vorstand.',
      majority: 'SIMPLE',
      status: 'OPEN',
      voters: 5,
      deadline: iso(now + 4 * DAY),
      openedAt: iso(now - DAY),
      yes: 1,
      no: 0,
      abstain: 0,
      ballots: ['kassier'],
    },
  ];
}
