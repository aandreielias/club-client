import type { Attachment } from 'svelte/attachments';
import { RecordDrag, type RecordRef } from '../lib/records/RecordDrag';

/**
 * Makes an element take dropped records of the given kinds (`[data-record-drop]` while one is over it;
 * other kinds show the no-drop cursor). `enabled` turns it off, e.g. outside edit mode.
 */
export function recordDrop(kinds: readonly string[], drop: (ref: RecordRef) => void, enabled: () => boolean = () => true): Attachment<HTMLElement> {
  return (node) => {
    const accepts = (e: DragEvent) => enabled() && RecordDrag.carries(e, kinds);
    const over = (e: DragEvent) => {
      if (!accepts(e)) return;
      e.preventDefault();
      e.dataTransfer!.dropEffect = 'copy';
      node.dataset.recordDrop = '';
    };
    const leave = (e: DragEvent) => {
      if (!node.contains(e.relatedTarget as Node | null)) delete node.dataset.recordDrop;
    };
    const dropped = (e: DragEvent) => {
      delete node.dataset.recordDrop;
      const ref = accepts(e) ? RecordDrag.get(e) : null;
      if (!ref) return;
      e.preventDefault();
      e.stopPropagation(); // an outer target (the whole message form) must not take it again
      drop(ref);
    };
    node.addEventListener('dragover', over);
    node.addEventListener('dragleave', leave);
    node.addEventListener('drop', dropped);
    return () => {
      node.removeEventListener('dragover', over);
      node.removeEventListener('dragleave', leave);
      node.removeEventListener('drop', dropped);
    };
  };
}
