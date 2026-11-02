import { directory } from '../../lib/container';
import type { Person } from './model';

/** Who may carry out a Beschluss: every active member, by name (admin and board load the member list). */
export async function activePeople(): Promise<Person[]> {
  return (await directory.allMembers())
    .filter((m) => m.active)
    .map((m) => ({ memberId: m.id, name: `${m.firstName} ${m.lastName}` }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}
