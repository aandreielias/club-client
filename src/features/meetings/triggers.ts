// What a TRIGGER follow-up waits for (server: MeetingsApi.Trigger, TriggerCatalog, platform.RecordEvents): an event of a club record whose
// attributes meet the conditions; appointments can also be limited to a date window.

export type TriggerRecord = 'FILE' | 'APPOINTMENT' | 'MEETING' | 'RESOLUTION' | 'OFFICE' | 'MEMBER' | 'TOURNAMENT';
export type TriggerField = 'folder' | 'file' | 'type' | 'team' | 'decision' | 'office' | 'kind';

export interface TriggerCondition {
  field: TriggerField;
  value: string;
  /** The name as the saver saw it (filled by the server). */
  label: string | null;
}

/** Days after the follow-up starts, or fixed dates (YYYY-MM-DD); once started only dates. */
export interface TriggerWindow {
  fromDays: number | null;
  toDays: number | null;
  fromDate: string | null;
  toDate: string | null;
}

export interface Trigger {
  record: TriggerRecord;
  event: string;
  conditions: TriggerCondition[];
  window: TriggerWindow | null;
}

/** server: TriggerCatalog — events, fields and whether a date window applies, per record. */
export const TRIGGER_CATALOG: Readonly<
  Record<TriggerRecord, { label: string; events: Record<string, string>; fields: TriggerField[]; window: boolean }>
> = {
  FILE: {
    label: 'Datei',
    events: { STORED: 'gespeichert (neu oder neue Version)', VERSION: 'neue Version hochgeladen' },
    fields: ['folder', 'file'],
    window: false,
  },
  APPOINTMENT: { label: 'Termin', events: { CREATED: 'angelegt' }, fields: ['type', 'team'], window: true },
  MEETING: { label: 'Sitzung', events: { INVITED: 'eingeladen', CLOSED: 'abgehalten' }, fields: ['type'], window: false },
  RESOLUTION: { label: 'Beschluss', events: { PASSED: 'gefasst' }, fields: ['decision'], window: false },
  OFFICE: { label: 'Funktion', events: { ASSIGNED: 'besetzt' }, fields: ['office'], window: false },
  MEMBER: { label: 'Mitglied', events: { INVITED: 'aufgenommen' }, fields: ['kind'], window: false },
  TOURNAMENT: { label: 'Turnier', events: { CREATED: 'angelegt' }, fields: [], window: false },
};

export const FIELD_LABELS: Readonly<Record<TriggerField, string>> = {
  folder: 'Ordner',
  file: 'Datei',
  type: 'Art',
  team: 'Team',
  decision: 'Beschlussart',
  office: 'Funktion',
  kind: 'Mitgliedsart',
};

/** Common triggers to start from; the builder fills in the rest. */
export const TRIGGER_PRESETS: readonly { key: string; label: string; trigger: Pick<Trigger, 'record' | 'event'>; window?: boolean }[] = [
  { key: 'file-folder', label: 'Datei in einem Ordner gespeichert', trigger: { record: 'FILE', event: 'STORED' } },
  { key: 'file-version', label: 'Neue Version einer bestimmten Datei', trigger: { record: 'FILE', event: 'VERSION' } },
  { key: 'appointment', label: 'Termin einer Art in einem Zeitraum angelegt', trigger: { record: 'APPOINTMENT', event: 'CREATED' }, window: true },
  { key: 'meeting-invited', label: 'Zu einer Sitzung einer Art eingeladen', trigger: { record: 'MEETING', event: 'INVITED' } },
  { key: 'meeting-closed', label: 'Sitzung einer Art abgehalten', trigger: { record: 'MEETING', event: 'CLOSED' } },
  { key: 'resolution', label: 'Beschluss einer Art gefasst', trigger: { record: 'RESOLUTION', event: 'PASSED' } },
  { key: 'office', label: 'Funktion besetzt', trigger: { record: 'OFFICE', event: 'ASSIGNED' } },
  { key: 'member', label: 'Mitglied aufgenommen', trigger: { record: 'MEMBER', event: 'INVITED' } },
  { key: 'tournament', label: 'Turnier angelegt', trigger: { record: 'TOURNAMENT', event: 'CREATED' } },
];

export const emptyWindow = (): TriggerWindow => ({ fromDays: null, toDays: null, fromDate: null, toDate: null });

export function newTrigger(record: TriggerRecord, event: string, window = false): Trigger {
  return { record, event, conditions: [], window: window ? { ...emptyWindow(), fromDays: 0, toDays: 30 } : null };
}

/** What is wrong with a trigger (server: TriggerCatalog.validate), or null. */
export function triggerProblem(t: Trigger | null): string | null {
  if (!t) return 'Wählen, was die Aufgabe erledigt.';
  const entry = TRIGGER_CATALOG[t.record];
  if (!entry || !(t.event in entry.events)) return 'Datensatz und Ereignis wählen.';
  if (t.conditions.some((c) => !entry.fields.includes(c.field) || !c.value.trim())) return 'Jede Bedingung braucht einen Wert.';
  const w = t.window;
  if (w) {
    if (!entry.window) return 'Nur Termine haben einen Zeitraum.';
    const days = [w.fromDays, w.toDays].filter((d) => d != null) as number[];
    if (days.some((d) => !Number.isInteger(d) || d < 0 || d > 365)) return 'Tage von 0 bis 365.';
    if (w.fromDays != null && w.toDays != null && w.fromDays > w.toDays) return 'Der Zeitraum endet vor seinem Beginn.';
    if (w.fromDate && w.toDate && w.fromDate > w.toDate) return 'Der Zeitraum endet vor seinem Beginn.';
    if (!days.length && !w.fromDate && !w.toDate) return 'Den Zeitraum angeben oder entfernen.';
  }
  return null;
}

const addDays = (date: string, days: number): string => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** server: TriggerCatalog.started — a window in days becomes dates from `start` (YYYY-MM-DD). */
export function startedTrigger(t: Trigger | null, start: string): Trigger | null {
  const w = t?.window;
  if (!t || !w || (w.fromDays == null && w.toDays == null)) return t;
  return {
    ...t,
    window: {
      fromDays: null,
      toDays: null,
      fromDate: w.fromDays == null ? start : addDays(start, w.fromDays),
      toDate: w.toDays == null ? null : addDays(start, w.toDays),
    },
  };
}

/** An event of a record (server: RecordEvents.RecordEvent); `date` YYYY-MM-DD for appointments. */
export interface RecordEvent {
  record: TriggerRecord;
  event: string;
  attrs: Partial<Record<TriggerField, string>>;
  date: string | null;
}

/** server: TriggerCatalog.matches */
export function triggerMatches(t: Trigger | null, e: RecordEvent): boolean {
  if (!t || t.record !== e.record) return false;
  const eventOk = t.record === 'FILE' && t.event === 'STORED' ? e.event === 'UPLOADED' || e.event === 'VERSION' : t.event === e.event;
  if (!eventOk) return false;
  for (const c of t.conditions) {
    const values = (e.attrs[c.field] ?? '').split(',').map((v) => v.trim());
    if (!values.includes(c.value)) return false;
  }
  const w = t.window;
  if (w && (!e.date || (w.fromDate && e.date < w.fromDate) || (w.toDate && e.date > w.toDate))) return false;
  return true;
}

const quoted = (t: Trigger, field: TriggerField): string | null => {
  const c = t.conditions.find((x) => x.field === field);
  return c ? `„${c.label ?? c.value}“` : null;
};

const dateText = (iso: string) => iso.split('-').reverse().join('.');

function windowText(w: TriggerWindow | null): string {
  if (!w) return '';
  if (w.fromDays != null || w.toDays != null) {
    return ` für ${w.fromDays ?? 0}${w.toDays == null ? ' oder mehr' : ` bis ${w.toDays}`} Tage nach dem Start`;
  }
  if (w.fromDate && w.toDate) return ` zwischen ${dateText(w.fromDate)} und ${dateText(w.toDate)}`;
  return w.fromDate ? ` ab ${dateText(w.fromDate)}` : w.toDate ? ` bis ${dateText(w.toDate)}` : '';
}

/** server: TriggerCatalog.describe — the end of "erledigt sich, sobald …". */
export function describeTrigger(t: Trigger | null): string {
  if (!t) return 'es eingetragen ist';
  const opt = (s: string | null) => (s ? ` ${s}` : '');
  const folder = quoted(t, 'folder');
  const file = quoted(t, 'file');
  const type = quoted(t, 'type');
  switch (t.record) {
    case 'FILE':
      if (file) return `eine neue Version von ${file} hochgeladen ist`;
      return `${t.event === 'VERSION' ? 'eine neue Version einer Datei' : 'eine Datei'}${folder ? ` im Ordner ${folder}` : ''} ${t.event === 'VERSION' ? 'hochgeladen' : 'gespeichert'} ist`;
    case 'APPOINTMENT': {
      const team = quoted(t, 'team');
      return `ein Termin${opt(type)}${team ? ` für ${team}` : ''}${windowText(t.window)} angelegt ist`;
    }
    case 'MEETING':
      return t.event === 'CLOSED' ? `eine Sitzung${opt(type)} abgehalten ist` : `zu einer Sitzung${opt(type)} eingeladen ist`;
    case 'RESOLUTION':
      return `ein Beschluss${opt(quoted(t, 'decision'))} gefasst ist`;
    case 'OFFICE':
      return `die Funktion${opt(quoted(t, 'office'))} besetzt ist`;
    case 'MEMBER':
      return `ein Mitglied${opt(quoted(t, 'kind'))} aufgenommen ist`;
    case 'TOURNAMENT':
      return 'ein Turnier angelegt ist';
  }
}
