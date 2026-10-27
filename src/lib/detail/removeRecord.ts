import { CONFIRM, TOAST } from '../../channels';
import type { EventBus } from '../bus';
import { APP_ERROR } from '../errors/ErrorReporter';

/** A club type or kind in a settings list. */
export interface Removable {
  label: string;
  inUse: boolean;
}

export interface RemoveOps {
  /** Deletes the unused record. */
  delete: () => Promise<unknown>;
  /** Saves the record with `archived` set; used records stay for what refers to them. */
  archive: (archived: boolean) => Promise<unknown>;
  reload: () => Promise<unknown>;
}

/**
 * Removes a type from its list after asking: deleted when nothing uses it, archived otherwise (the server refuses deleting a used one).
 * {@code noun}: "Sitzungsart", "Mitgliedsart", "Terminart". Resolves true when it is gone from the list.
 */
export async function removeRecord(bus: EventBus, item: Removable, noun: string, ops: RemoveOps): Promise<boolean> {
  const message = item.inUse
    ? `„${item.label}“ wird verwendet und darum archiviert: Bestehendes behält sie, für Neues ist sie nicht mehr wählbar.`
    : `„${item.label}“ wird gelöscht.`;
  if (!(await bus.request(CONFIRM, { title: `${noun} entfernen`, message, confirmLabel: 'Entfernen', danger: true }))) return false;
  try {
    await (item.inUse ? ops.archive(true) : ops.delete());
    await ops.reload();
    bus.publish(TOAST, { text: item.inUse ? `${noun} archiviert.` : `${noun} gelöscht.` });
    return true;
  } catch (error) {
    bus.publish(APP_ERROR, error);
    return false;
  }
}

/** Takes an archived type back into use. */
export async function restoreRecord(bus: EventBus, noun: string, ops: RemoveOps): Promise<void> {
  try {
    await ops.archive(false);
    await ops.reload();
    bus.publish(TOAST, { text: `${noun} wiederhergestellt.` });
  } catch (error) {
    bus.publish(APP_ERROR, error);
  }
}
