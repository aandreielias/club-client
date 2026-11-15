import { attempt, confirmed, inWindow, type RecordActionProvider } from '../../lib/actions/RecordActions';
import { bus, directory } from '../../lib/container';
import type { Team } from '../../lib/types';
import { TEAMS_CHANGED } from './events';
import { teamPolicy as policy, teamsApi } from './services';

/** Lists and names read the teams from the directory. */
function changed() {
  directory.forgetTeams();
  bus.publish(TEAMS_CHANGED);
}

/** What can be done with a team: context menus, its window and the command palette. */
export const teamActions: RecordActionProvider<Team> = {
  load: async (id) => (await teamsApi.roster(id)).team,
  actions: (t) => [
    ...(policy.canAssign() ? [inWindow(bus, 'team', t.id, 'team.addMember', { icon: 'add', group: 'roster' })] : []),
    ...(policy.canRequestPlayer(t.id) ? [inWindow(bus, 'team', t.id, 'team.requestPlayer', { group: 'roster' })] : []),
    ...(policy.canEdit()
      ? [
          inWindow(bus, 'team', t.id, 'record.edit', { icon: 'edit', group: 'edit' }),
          inWindow(bus, 'team', t.id, 'team.newSeason', { group: 'edit' }),
          {
            command: t.archived ? ('record.restore' as const) : ('record.archive' as const),
            icon: 'archive' as const,
            group: 'edit',
            run: async () => {
              const ok = await attempt(
                bus,
                () => teamsApi.update(t.id, { archived: !t.archived }),
                t.archived ? 'Team wiederhergestellt.' : 'Team archiviert.',
              );
              if (ok) changed();
              return ok;
            },
          },
          {
            command: 'record.delete' as const,
            icon: 'delete' as const,
            danger: true,
            group: 'remove',
            leaves: true,
            run: async () => {
              const ok = await confirmed(
                bus,
                { title: 'Team löschen', message: `„${t.name}“ wird gelöscht, die Mitgliedschaften mit ihm.`, confirmLabel: 'Löschen', danger: true },
                () => teamsApi.delete(t.id),
                'Team gelöscht.',
              );
              if (ok) changed();
              return ok;
            },
          },
        ]
      : []),
  ],
};
