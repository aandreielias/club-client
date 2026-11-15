import { catalogActions } from '../../lib/actions/catalogActions';
import { confirmed, attempt, inWindow, type RecordActionProvider } from '../../lib/actions/RecordActions';
import { bus, pendingDeletes, permissions } from '../../lib/container';
import type { Appointment, Holiday } from './model';
import { appointmentPolicy as policy, appointmentTypes, calendarApi, holidays } from './services';

/** What can be done with an appointment: context menus, its window and the command palette. */
export const appointmentActions: RecordActionProvider<Appointment> = {
  load: (id) => calendarApi.get(id),
  actions: (a) => {
    if (policy.canRestore(a))
      return [
        {
          command: 'record.restore',
          label: 'Absage zurücknehmen',
          run: () => attempt(bus, () => calendarApi.restore(a.id), 'Absage zurückgenommen.'),
        },
      ];
    if (!policy.canEdit(a)) return [];
    return [
      inWindow(bus, 'appointment', a.id, 'record.edit', { icon: 'edit', group: 'edit' }),
      ...(a.seriesId ? [inWindow(bus, 'appointment', a.id, 'appointment.extend', { group: 'edit' })] : []),
      inWindow(bus, 'appointment', a.id, 'appointment.cancel', { label: 'Absagen', danger: true, group: 'remove' }),
      {
        command: 'record.delete',
        icon: 'delete',
        danger: true,
        group: 'remove',
        leaves: true,
        run: () =>
          confirmed(
            bus,
            {
              title: 'Termin löschen',
              message: `„${a.title}“ wird endgültig gelöscht. Das geht nur, solange niemand geantwortet hat; sonst bitte absagen.`,
              confirmLabel: 'Löschen',
              danger: true,
            },
            () => calendarApi.delete(a.id),
            'Termin gelöscht.',
          ),
      },
    ];
  },
};

export const appointmentTypeActions = catalogActions(bus, 'appointment-type', 'Terminart', appointmentTypes, () => permissions.isManager);

export const holidayActions: RecordActionProvider<Holiday> = {
  load: async (id) => {
    await holidays.load();
    const holiday = holidays.get(id);
    if (!holiday) throw new Error(`holiday ${id} not found`);
    return holiday;
  },
  actions: (h) =>
    permissions.isManager
      ? [
          inWindow(bus, 'holiday', h.id, 'record.edit', { icon: 'edit', group: 'edit' }),
          {
            command: 'record.delete',
            icon: 'delete',
            danger: true,
            group: 'edit',
            leaves: true,
            run: () =>
              pendingDeletes.schedule({
                ids: [h.id],
                text: `„${h.name}“ gelöscht. Bestehende Termine bleiben.`,
                commit: () => calendarApi.deleteHoliday(h.id).then(() => holidays.load()),
              }),
          },
        ]
      : [],
};
