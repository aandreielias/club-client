import { directory } from '../../lib/container';
import { ROLE_LABELS } from '../../lib/types';
import { boardSettings } from '../members/services';
import type { MailboxOwners } from './model';

/** "Vorstand, Kassier:in, Trainer:innen U17": who reads a shared mailbox (callers load boardSettings and the teams). */
export function ownersText(owners: MailboxOwners): string {
  const teams = owners.teamIds.map((id) => `Trainer:innen ${directory.teams.find((t) => t.id === id)?.name ?? 'Mannschaft'}`);
  const members = owners.memberIds.map((id) => directory.nameOf(id));
  return [...owners.roles.map((r) => ROLE_LABELS[r]), ...owners.offices.map((k) => boardSettings.label(k)), ...teams, ...members].join(', ');
}
