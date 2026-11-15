import { catalogActions } from '../../lib/actions/catalogActions';
import { attempt, confirmed, inWindow, type RecordActionProvider } from '../../lib/actions/RecordActions';
import { bus, pendingDeletes } from '../../lib/container';
import { invitesVoters, type Meeting, type Resolution } from './model';
import { meetingPolicy as policy, meetingsApi, meetingTypes } from './services';

/** The invitation deadline has passed: the draft must move first. */
export const lateToInvite = (m: Meeting) => m.latestInvite < new Date().toISOString();

/** What who runs a meeting can do with it: context menus, its window and the command palette. */
export const meetingActions: RecordActionProvider<Meeting> = {
  load: (id) => meetingsApi.get(id),
  actions: (m) => {
    if (!m.canManage) return [];
    switch (m.status) {
      case 'DRAFT': {
        const who = m.chosen
          ? 'die Eingeladenen (Gäste per E-Mail)'
          : invitesVoters(meetingTypes.get(m.kind))
            ? 'alle stimmberechtigten Mitglieder'
            : 'den Vorstand';
        return [
          ...(lateToInvite(m)
            ? []
            : [
                {
                  command: 'meeting.invite' as const,
                  label: 'Einladen',
                  group: 'stage',
                  run: () =>
                    confirmed(
                      bus,
                      {
                        title: 'Einladung verschicken',
                        message: `Die Einladung mit Tagesordnung geht per E-Mail und App an ${who}. Danach steht der Termin fest.`,
                        confirmLabel: 'Einladen',
                      },
                      () => meetingsApi.invite(m.id),
                      'Einladung verschickt.',
                    ),
                },
              ]),
          inWindow(bus, 'meeting', m.id, 'record.edit', { label: 'Entwurf bearbeiten', icon: 'edit', group: 'edit' }),
          {
            command: 'record.delete',
            icon: 'delete',
            danger: true,
            group: 'edit',
            leaves: true,
            run: () => pendingDeletes.schedule({ ids: [m.id], text: `Entwurf „${m.title}“ gelöscht.`, commit: () => meetingsApi.delete(m.id) }),
          },
        ];
      }
      case 'INVITED':
        return [
          { command: 'meeting.open', group: 'stage', run: () => attempt(bus, () => meetingsApi.open(m.id), 'Sitzung eröffnet.') },
          {
            command: 'meeting.cancel',
            label: 'Absagen',
            danger: true,
            group: 'remove',
            run: () =>
              confirmed(
                bus,
                {
                  title: 'Sitzung absagen',
                  message: 'Alle Eingeladenen erfahren, dass die Sitzung nicht stattfindet. Das lässt sich nicht rückgängig machen.',
                  confirmLabel: 'Absagen',
                  danger: true,
                },
                () => meetingsApi.cancel(m.id),
                'Sitzung abgesagt.',
              ),
          },
        ];
      // Closing saves the protocol typed in the window.
      case 'OPEN':
        return [inWindow(bus, 'meeting', m.id, 'meeting.close', { group: 'stage' })];
      default:
        return [];
    }
  },
};

/** A resolution's own actions; voting and opening a vote stay on its card (they need the meeting's state). */
export const resolutionActions: RecordActionProvider<Resolution> = {
  load: (id) => meetingsApi.resolution(id),
  actions: (r) => {
    if (!r.canManage) return [];
    if (r.status === 'DRAFT')
      return [
        {
          command: 'record.delete',
          label: 'Entwurf löschen',
          icon: 'delete',
          danger: true,
          group: 'edit',
          leaves: true,
          run: () =>
            pendingDeletes.schedule({ ids: [r.id], text: `Entwurf „${r.title}“ gelöscht.`, commit: () => meetingsApi.deleteResolution(r.id) }),
        },
      ];
    if (r.status !== 'CLOSED' && r.voteMode !== 'HAND')
      return [
        {
          command: 'resolution.close',
          group: 'stage',
          run: () =>
            confirmed(
              bus,
              {
                title: 'Abstimmung schließen',
                message: `${r.ballots} von ${r.meetingId ? r.presentVoters : r.voters} haben abgestimmt.`,
                confirmLabel: 'Schließen',
              },
              () => meetingsApi.closeResolution(r.id),
              'Abstimmung geschlossen.',
            ),
        },
      ];
    return [];
  },
};

export const meetingTypeActions = catalogActions(bus, 'meeting-type', 'Sitzungsart', meetingTypes, () => policy.canEditTypes());
