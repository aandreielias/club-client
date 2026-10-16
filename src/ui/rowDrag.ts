/** Dragging rows or tiles onto others (files onto folders), shared by DataTable and galleries. */
export interface RowDrag<T> {
  /** Data type of the payload, e.g. "application/x-club-files". */
  type: string;
  can: (item: T) => boolean;
  payload: (item: T) => string;
  accepts: (item: T) => boolean;
  drop: (item: T, payload: string) => void;
}

export class RowDragging {
  static start<T>(drag: RowDrag<T>, item: T, event: DragEvent): void {
    if (!drag.can(item) || !event.dataTransfer) return;
    event.dataTransfer.setData(drag.type, drag.payload(item));
    event.dataTransfer.effectAllowed = 'move';
  }

  /** True (and the drop is allowed) when the item takes this payload. */
  static over<T>(drag: RowDrag<T>, item: T, event: DragEvent): boolean {
    if (!drag.accepts(item) || !event.dataTransfer?.types.includes(drag.type)) return false;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    return true;
  }

  static drop<T>(drag: RowDrag<T>, item: T, event: DragEvent): void {
    const payload = event.dataTransfer?.getData(drag.type);
    if (!payload || !drag.accepts(item)) return;
    event.preventDefault();
    drag.drop(item, payload);
  }
}
