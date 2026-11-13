import { directory } from '../../lib/container';
import type { Person } from './model';

/** Who may carry out a Beschluss: every active member, by name (admin and board load the member list). */
export async function activePeople(): Promise<Person[]> {
  return [...(await directory.candidates(null))].sort((a, b) => a.name.localeCompare(b.name, 'de'));
}
