import { WINDOW_OPEN } from '../../channels';
import { bus, session } from '../../lib/container';
import type { MenuEntry } from '../../lib/overlay/ContextMenuService.svelte';
import type { CalendarModel } from './CalendarModel.svelte';
import { appointmentPolicy as policy } from './services';

/** Opens a new appointment on a day of the calendar, for its team (managers, coaches). */
export function createAppointment(model: CalendarModel, date: string): void {
  if (!policy.canCreate()) return;
  const team = model.teamId ? `team=${model.teamId}&` : '';
  bus.publish(WINDOW_OPEN, { kind: 'appointment-new', id: `${team}date=${date}` });
}

/** Right-click on a day: a new appointment there, for who may create one. */
export function newAppointmentEntries(model: CalendarModel, date: string): MenuEntry[] {
  return policy.canCreate() ? [{ label: `Neuer Termin am ${session.format.date(date)}`, run: () => createAppointment(model, date), command: 'page.new' }] : [];
}
