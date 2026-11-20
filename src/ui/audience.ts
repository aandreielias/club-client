import { directory } from '../lib/container';
import { ROLE_LABELS, type Role } from '../lib/types';
import { boardSettings, membershipKinds } from '../features/members/services';

let loaded = false;

/** Loads what audience entries are named by (offices, kinds, teams, member names), once per page load. */
export function loadAudienceLabels(): void {
  if (loaded) return;
  loaded = true;
  void boardSettings.load();
  void membershipKinds.load();
  void directory.loadTeams().catch(() => {});
  void directory.loadNames();
}

/** The name of one audience entry (`lib/reach audienceOf`), also when no longer offered (archived, switched off). */
export function audienceLabel(entry: string): string {
  const at = entry.indexOf(':');
  const [kind, key] = [entry.slice(0, at), entry.slice(at + 1)];
  if (kind === 'role') return ROLE_LABELS[key as Role] ?? key;
  if (kind === 'office') return boardSettings.label(key);
  if (kind === 'team') return directory.teamName(key) ?? 'Team';
  if (kind === 'kind') return membershipKinds.label(key);
  return directory.nameOf(key);
}
