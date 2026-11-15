import { attempt, inWindow, type RecordActionProvider } from '../../lib/actions/RecordActions';
import { bus, pendingDeletes } from '../../lib/container';
import type { Tournament } from './model';
import { tournamentPolicy as policy, tournamentsApi } from './services';

/** What can be done with a tournament: context menus, its window and the command palette. */
export const tournamentActions: RecordActionProvider<Tournament> = {
  load: (id) => tournamentsApi.get(id),
  actions: (t) => [
    ...(policy.canManage() && t.status === 'DRAFT' && t.teams.length >= 2
      ? [{ command: 'tournament.draw' as const, group: 'stage', run: () => attempt(bus, () => tournamentsApi.draw(t.id), 'Ausgelost.') }]
      : []),
    // Every group match needs its result first.
    ...(policy.canManage() && t.status === 'GROUPS' && !t.matches.some((m) => m.stage === 'GROUP' && m.homeScore === null)
      ? [
          {
            command: 'tournament.knockout' as const,
            group: 'stage',
            run: () => attempt(bus, () => tournamentsApi.startKnockout(t.id), 'KO-Runde gestartet.'),
          },
        ]
      : []),
    ...(policy.canManage() ? [inWindow(bus, 'tournament', t.id, 'record.edit', { icon: 'edit', group: 'edit' })] : []),
    ...(policy.canDelete()
      ? [
          {
            command: 'record.delete' as const,
            icon: 'delete' as const,
            danger: true,
            group: 'edit',
            leaves: true,
            run: () => pendingDeletes.schedule({ ids: [t.id], text: `„${t.name}“ gelöscht.`, commit: () => tournamentsApi.delete(t.id) }),
          },
        ]
      : []),
  ],
};
