import { settings } from '../../settings';

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface DragTarget<D> {
  element: HTMLElement;
  /** Docked, the drag first undocks it into the middle, at the middle size under the pointer. */
  docked: boolean;
  /** The middle size, measured before undocking. */
  middle: () => { width: number; height: number };
  /** Moves it to the middle placement; resolves once that is rendered. */
  undock: () => Promise<void>;
  /** The dock a window with this box would take when released, or null. */
  snapAt: (box: Box) => D | null;
  /** Shows (or with null hides) the preview of that dock. */
  preview: (dock: D | null) => void;
  drop: (dock: D) => void;
}

type Drag = typeof settings.window.drag;

/** The box `leadMs` ahead at the drag's velocity (px/ms), kept on the screen, so a fast drag toward an edge docks early. */
export function projected(box: Box, velocity: { x: number; y: number }, leadMs: number, view: { width: number; height: number }): Box {
  return {
    ...box,
    left: clamp(box.left + velocity.x * leadMs, view.width - box.width),
    top: clamp(box.top + velocity.y * leadMs, view.height - box.height),
  };
}

const clamp = (value: number, max: number) => Math.max(0, Math.min(value, max));

/**
 * Drags a floating window (detail window, video call) by its header anywhere on the screen. Released near an edge it docks
 * there (`snapAt`, judged `leadMs` ahead at the drag's speed); a see-through preview shows where. Alt held: never docks.
 */
export function dragWindow<D>(event: PointerEvent, target: DragTarget<D>, drag: Drag = settings.window.drag): void {
  const handle = event.currentTarget as HTMLElement;
  const { element } = target;
  const box = element.getBoundingClientRect();
  const start = { x: event.clientX, y: event.clientY };
  let size = { width: box.width, height: box.height };
  let grab = target.docked ? null : { dx: start.x - box.left, dy: start.y - box.top };
  let dragging = true;
  let undocking = false;
  let last = { ...start, at: event.timeStamp };
  let velocity = { x: 0, y: 0 };
  let snap: D | null = null;
  let alt = event.altKey;
  let rest: ReturnType<typeof setTimeout> | undefined;
  event.preventDefault();
  handle.setPointerCapture(event.pointerId);
  const root = document.documentElement;
  if (grab) root.dataset.windowResizing = '';

  const view = () => ({ width: window.innerWidth, height: window.innerHeight });
  const current = (): Box => ({
    left: clamp(last.x - grab!.dx, window.innerWidth - size.width),
    top: clamp(last.y - grab!.dy, window.innerHeight - size.height),
    ...size,
  });
  const follow = () => {
    const at = current();
    element.style.left = `${at.left}px`;
    element.style.top = `${at.top}px`;
  };
  const show = (next: D | null) => {
    if (next !== snap) target.preview((snap = next));
  };
  // The preview always shows what a release would do now: Alt pressed or let go, or a rest that ends the lead.
  const update = () => grab && show(alt ? null : target.snapAt(projected(current(), velocity, drag.leadMs, view())));
  const key = (e: KeyboardEvent) => {
    if (e.key !== 'Alt') return;
    e.preventDefault(); // no menu bar in Firefox and Windows
    alt = e.type === 'keydown';
    update();
  };
  const undock = async () => {
    size = target.middle();
    // Same spot of the window under the pointer, scaled to the middle size.
    const at = { dx: ((start.x - box.left) / box.width) * size.width, dy: ((start.y - box.top) / box.height) * size.height };
    await target.undock();
    grab = at;
    follow();
    // The shrink into the middle animates; afterwards the window follows the pointer at once.
    setTimeout(() => dragging && (root.dataset.windowResizing = ''), settings.motion.window);
  };
  const move = (e: PointerEvent) => {
    const dt = Math.max(1, e.timeStamp - last.at);
    // Smoothed, so one jittery event does not decide.
    velocity = { x: velocity.x * 0.6 + ((e.clientX - last.x) / dt) * 0.4, y: velocity.y * 0.6 + ((e.clientY - last.y) / dt) * 0.4 };
    last = { x: e.clientX, y: e.clientY, at: e.timeStamp };
    alt = e.altKey;
    if (grab) {
      follow();
      update();
      // Held still: judged where the window is, not where it was heading (a preview shown only by the lead goes).
      clearTimeout(rest);
      rest = setTimeout(() => {
        velocity = { x: 0, y: 0 };
        update();
      }, drag.leadMs);
    } else if (!undocking && Math.hypot(last.x - start.x, last.y - start.y) > drag.undockPx) {
      undocking = true;
      void undock();
    }
  };
  const end = (e: PointerEvent) => {
    dragging = false;
    clearTimeout(rest);
    const dock = e.type === 'pointerup' && !e.altKey ? snap : null;
    delete root.dataset.windowResizing;
    show(null);
    if (dock !== null) {
      void element.offsetWidth; // let the window's own transition carry it from here into the dock
      target.drop(dock);
    }
    handle.removeEventListener('pointermove', move);
    handle.removeEventListener('pointerup', end);
    handle.removeEventListener('pointercancel', end);
    window.removeEventListener('keydown', key);
    window.removeEventListener('keyup', key);
  };
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
  window.addEventListener('keydown', key);
  window.addEventListener('keyup', key);
}
