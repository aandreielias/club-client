/** A record being dragged: its window kind and id (files: `folderId:fileId`, as their window) and its name. */
export interface RecordRef {
  kind: string;
  id: string;
  title: string;
}

/**
 * Dragging any record (a name, a list row, a calendar entry, a photo) onto something that links it.
 * While dragging only the data types can be read, not the data, so the kind travels as its own type
 * too and drop targets can refuse kinds before the drop.
 */
export class RecordDrag {
  static readonly TYPE = 'application/x-club-record';

  static set(event: DragEvent, ref: RecordRef): void {
    const data = event.dataTransfer;
    if (!data) return;
    // Rows that also move (files onto folders) already set their own payload: allow both.
    const moves = data.types.length > 0;
    data.setData(RecordDrag.TYPE, JSON.stringify(ref));
    data.setData(RecordDrag.kindType(ref.kind), '');
    data.effectAllowed = moves ? 'copyMove' : 'copy';
  }

  /** True while a record of one of `kinds` (any kind without) is dragged over. */
  static carries(event: DragEvent, kinds?: readonly string[]): boolean {
    const types = event.dataTransfer?.types ?? [];
    if (!types.includes(RecordDrag.TYPE)) return false;
    return !kinds || kinds.some((kind) => types.includes(RecordDrag.kindType(kind)));
  }

  /** The dropped record, or null for anything else (foreign or malformed data). */
  static get(event: DragEvent): RecordRef | null {
    try {
      const ref = JSON.parse(event.dataTransfer?.getData(RecordDrag.TYPE) || 'null') as Partial<RecordRef> | null;
      return ref && typeof ref.kind === 'string' && typeof ref.id === 'string' && typeof ref.title === 'string' && ref.id
        ? { kind: ref.kind, id: ref.id, title: ref.title }
        : null;
    } catch {
      return null;
    }
  }

  private static kindType(kind: string): string {
    return `${RecordDrag.TYPE}-${kind.toLowerCase()}`;
  }
}
