import type { CalendarEntry, CalendarSources } from '../../lib/calendar/CalendarSources';
import type { EventBus } from '../../lib/bus';
import { APP_ERROR } from '../../lib/errors/ErrorReporter';
import { TOAST } from '../../lib/notify/ToastService.svelte';
import { CalendarDrag, type ResizeEdge, type ResizeMode } from './CalendarDrag';

export interface ResizePreview {
  key: string;
  start: string;
  end: string;
}

/**
 * Changing an entry's length by pulling an edge (pointer events: mouse, pen and touch). While pulling, `preview` shows the new
 * range in the views; releasing saves it, Escape or a cancelled pointer drops it.
 */
export class CalendarResize {
  constructor(
    private readonly drag: CalendarDrag,
    private readonly sources: CalendarSources,
    private readonly preview: (preview: ResizePreview | null) => void,
    private readonly reload: () => void,
    private readonly bus?: EventBus,
  ) {}

  begin(event: PointerEvent, entry: CalendarEntry, edge: ResizeEdge, mode: ResizeMode): void {
    if (!this.drag.canResize(entry) || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    let next: { start: string; end: string } | null = null;

    const move = (e: PointerEvent) => {
      const spot = CalendarDrag.spotAt(e.clientX, e.clientY);
      if (!spot) return;
      next = this.drag.resized(entry, edge, mode, spot);
      this.preview(next ? { key: entry.key, ...next } : null);
    };
    const finish = async (commit: boolean) => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', escape, true);
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      if (!commit || !next) {
        this.preview(null);
        return;
      }
      try {
        await this.sources.move(entry, next.start, next.end);
        this.bus?.publish(TOAST, { text: `„${entry.title}“ geändert.` });
        this.reload();
      } catch (error) {
        this.bus?.publish(APP_ERROR, error);
      } finally {
        this.preview(null);
      }
    };
    const up = () => void finish(true);
    const cancel = () => void finish(false);
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      void finish(false);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', escape, true);
  }
}
