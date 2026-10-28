import type { RecordRef } from './RecordDrag';
import { DROPPABLE, type LinkedRef, type RefKind } from './refs';

export type PickedRef = Omit<LinkedRef, 'parentId'>;

/** Records being linked (message, meeting): no duplicates, at most `max`. */
export class RefList {
  refs = $state<PickedRef[]>([]);

  constructor(
    readonly max: number,
    initial: readonly PickedRef[] = [],
  ) {
    this.refs = [...initial];
  }

  hasRef(kind: RefKind, id: string): boolean {
    return this.refs.some((r) => r.kind === kind && r.id === id);
  }

  addRef(ref: PickedRef): void {
    if (!this.hasRef(ref.kind, ref.id) && this.refs.length < this.max) this.refs = [...this.refs, ref];
  }

  /** A dropped record; false when it cannot be linked (kind, duplicate, limit). */
  addRecord(record: RecordRef): boolean {
    const ref = RefList.toRef(record);
    if (!ref || this.hasRef(ref.kind, ref.id) || this.refs.length >= this.max) return false;
    this.addRef(ref);
    return true;
  }

  /** The link a dragged record becomes, or null for kinds that cannot be linked. */
  static toRef(record: RecordRef): PickedRef | null {
    const kind = DROPPABLE[record.kind];
    // Files travel as `folderId:fileId` (their window id); the server links the file id.
    const id = kind === 'FILE' ? record.id.slice(record.id.indexOf(':') + 1) : record.id;
    return kind && id ? { kind, id, title: record.title } : null;
  }

  removeRef(ref: PickedRef): void {
    this.refs = this.refs.filter((r) => !(r.kind === ref.kind && r.id === ref.id));
  }
}
