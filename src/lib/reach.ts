import { settings } from '../settings';
import type { Role } from './types';

/**
 * server: platform.Reach — members holding any listed role, running office, team or membership kind, plus named members;
 * or `everyone` ("Ganzer Verein"). Used by tasks and appointments.
 */
export interface Reach {
  roles: Role[];
  offices: string[];
  teamIds: string[];
  kinds: string[];
  memberIds: string[];
  everyone: boolean;
}

export const NO_AUDIENCE: Reach = { roles: [], offices: [], teamIds: [], kinds: [], memberIds: [], everyone: false };
export const EVERYONE: Reach = { ...NO_AUDIENCE, everyone: true };

export const hasAudience = (a: Reach): boolean => a.everyone || [a.roles, a.offices, a.teamIds, a.kinds, a.memberIds].some((list) => list.length > 0);

/** Chosen people and groups ("Bestimmte Personen und Gruppen"), not the whole club. */
export const isChosen = (a: Reach): boolean => hasAudience(a) && !a.everyone;

/** An audience entry as one chip value: `role:COACH`, `office:TREASURER`, `team:<id>`, `kind:<key>`, `member:<id>`. */
const AUDIENCE_KEYS = { role: 'roles', office: 'offices', team: 'teamIds', kind: 'kinds', member: 'memberIds' } as const;

export function audienceOf(entries: readonly string[]): Reach {
  const audience: Reach = { roles: [], offices: [], teamIds: [], kinds: [], memberIds: [], everyone: false };
  for (const entry of entries) {
    const at = entry.indexOf(':');
    const key = AUDIENCE_KEYS[entry.slice(0, at) as keyof typeof AUDIENCE_KEYS];
    if (key) (audience[key] as string[]).push(entry.slice(at + 1));
  }
  return audience;
}

export const audienceEntries = (a: Reach): string[] =>
  (Object.keys(AUDIENCE_KEYS) as (keyof typeof AUDIENCE_KEYS)[]).flatMap((prefix) => a[AUDIENCE_KEYS[prefix]].map((v) => `${prefix}:${v}`));

/** Two chosen audiences hold the same entries, in any order. */
export const sameAudience = (a: Reach, b: Reach): boolean => {
  const x = audienceEntries(a);
  const y = new Set(audienceEntries(b));
  return a.everyone === b.everyone && x.length === y.size && x.every((e) => y.has(e));
};

/** Form check of chosen entries; null when they are fine. */
export function audienceError(entries: readonly string[]): string | null {
  const a = audienceOf(entries);
  if (!hasAudience(a)) return 'Mindestens eine Rolle, Funktion, Mannschaft, Mitgliedsart oder Person wählen.';
  const max = settings.audience.maxEntries;
  return [a.roles, a.offices, a.teamIds, a.kinds, a.memberIds].some((l) => l.length > max) ? `Höchstens ${max} je Art.` : null;
}
