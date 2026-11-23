import { getContext, setContext, type Component } from 'svelte';
import { defineEvent, type EventBus } from '../bus';
import { Router } from '../router/Router.svelte';
import type { LocalStore } from '../storage/LocalStore';
import type { Role } from '../types';
import type { CommandId } from '../../shortcuts';

export type Dock = 'center' | 'side' | 'bottom';

const DOCKS: readonly Dock[] = ['center', 'side', 'bottom'];

/** What a window shows: a registered content kind plus the record id. */
export interface WindowTarget {
  kind: string;
  id: string;
}

export interface DockSizes {
  side: number | null;
  bottom: number | null;
}

export interface ResizeLimits {
  minSidePx: number;
  minBottomPx: number;
  pageMinWidthPx: number;
  pageMinHeightPx: number;
}

/**
 * Opens a record in a window: the one already showing it, else the focused one (or the one in `dock`), else a new one.
 * `newWindow` (or a Ctrl/Cmd click) always opens a new window; `command` then runs in it (e.g. edit).
 */
export const WINDOW_OPEN = defineEvent<WindowTarget & { dock?: Dock; command?: CommandId; newWindow?: boolean }>('ui/window/open');
/** Closes the focused window. */
export const WINDOW_CLOSE = defineEvent('ui/window/close');

/** One open window: what it shows, where, and its key (stable while it stays open, also when its record changes). */
export interface OpenWindow extends WindowTarget {
  key: string;
  /** Where it is, or where it goes back to when minimized. */
  dock: Dock;
  /** A tab in the footer (WindowTabs) instead of a window. */
  minimized: boolean;
}

/** Given to window contents so they can talk to their window. */
export interface WindowHandle {
  setTitle(title: string): void;
  /** `then` runs once the window is gone from the address (e.g. to open the split view next). */
  close(then?: () => void): void;
  /** Shows another record in the window; Back (Escape) returns to the current one. */
  open(kind: string, id: string): void;
  /** Replaces the content without a way back (e.g. the new record after its create form). */
  replace(kind: string, id: string): void;
  /** Leaves the window for a full page. */
  navigate(path: string): void;
  /** The window is the focused one (its commands and keys work). */
  readonly focused: boolean;
}

const HANDLE = Symbol('window-handle');

/** WindowHost provides each window's handle, so links inside its content open records with a way back. */
export function provideWindowHandle(handle: WindowHandle): void {
  setContext(HANDLE, handle);
}

export function windowHandle(): WindowHandle | undefined {
  return getContext<WindowHandle | undefined>(HANDLE);
}

interface WindowContentProps {
  id: string;
  handle: WindowHandle;
}

export interface WindowContent {
  /** What the window shows, e.g. "Aufgabe" (second line of its tab when minimized). */
  label: string;
  component: Component<WindowContentProps>;
  /** Full-page route for "Als Seite öffnen"; omitted when there is none. */
  page?: (id: string) => string;
  /** Only members with one of these roles may open it; others see no window (also via links). */
  roles?: readonly Role[];
  /** Finer check per record (e.g. coaches see only their teams' members); read reactively. */
  canOpen?: (id: string) => boolean;
}

/**
 * The detail windows of the app: one docked at the side, one at the bottom and any number in the middle. They live in the
 * URL (`?open=kind/id@dock`, `@dock.min` when minimized, one per window, in opening order), so reload keeps them, links can be shared and Back closes
 * the last one opened. The focused window takes records opened from outside; the placement for new ones is remembered.
 */
export class WindowService {
  static readonly PARAM = 'open';
  /** Stacking key of the video call, which shares the order with the windows. */
  static readonly CALL = 'call';
  private static readonly DOCK_KEY = 'window-dock';
  private static readonly SIZE_KEY = 'window-size';
  private static readonly Z_BASE = 31;

  /** Placement of new windows, remembered per browser (the last one a window was moved to). */
  dock = $state<Dock>('center');
  /** Docked width (side) and height (bottom) in px, dragged at the inner edge; null keeps the theme's default. */
  size = $state<DockSizes>({ side: null, bottom: null });
  /** Command to run in the window once its view handles it (WindowHost), e.g. "Bearbeiten" from a context menu. */
  pendingCommand = $state<(WindowTarget & { command: CommandId }) | null>(null);
  /** Open windows in opening order (the URL's). */
  readonly list: readonly OpenWindow[];
  /** Minimized windows as footer tabs, in the order they were minimized (the first sits rightmost). */
  readonly tabs: readonly OpenWindow[];
  /** The window last used (clicked, focused or opened, never a minimized one), which takes records opened from outside. */
  readonly focused: OpenWindow | null;
  /** What the focused window shows. */
  readonly current: WindowTarget | null;

  readonly #contents = new Map<string, WindowContent>();
  #titles = $state<Record<string, string>>({});
  /** Per window: records shown before the current one, oldest first (opened from inside the window). */
  readonly #trails = new Map<string, WindowTarget[]>();
  #trailDepths = $state<Record<string, number>>({});
  /** Stacking order of window keys and the call, topmost last. */
  #stack = $state<string[]>([]);
  /** Keys in the order their windows were minimized. */
  #minimizedOrder = $state<string[]>([]);
  /** The window whose opening pushed the newest history entry (nothing else changed since): closing it goes back. */
  #pushed: string | null = null;
  #previous: readonly OpenWindow[] = [];
  #nextKey = 0;

  constructor(
    private readonly router: Router,
    private readonly store: LocalStore,
    defaultDock: Dock,
    bus: EventBus,
    /** Asked before a window closes (unsaved changes); false keeps it open. */
    private readonly mayClose: () => boolean | Promise<boolean> = () => true,
    /** Role check of the signed-in member. */
    private readonly hasRole: (roles: readonly Role[]) => boolean = () => true,
  ) {
    bus.subscribe(WINDOW_OPEN, (request) => this.openFromOutside(request));
    bus.subscribe(WINDOW_CLOSE, () => this.close());
    const stored = store.get<Dock>(WindowService.DOCK_KEY);
    this.dock = stored && DOCKS.includes(stored) ? stored : defaultDock;
    const sizes = store.get<Partial<DockSizes>>(WindowService.SIZE_KEY);
    this.size = { side: WindowService.px(sizes?.side), bottom: WindowService.px(sizes?.bottom) };
    this.list = $derived(this.reconcile(this.router.query.getAll(WindowService.PARAM)));
    const shown = $derived(this.list.filter((w) => !w.minimized));
    this.focused = $derived.by(() => {
      const top = [...this.#stack].reverse().find((key) => shown.some((w) => w.key === key));
      return shown.find((w) => w.key === top) ?? shown.at(-1) ?? null;
    });
    this.tabs = $derived.by(() => {
      const rank = (w: OpenWindow) => this.#minimizedOrder.indexOf(w.key);
      return this.list.filter((w) => w.minimized).sort((a, b) => rank(a) - rank(b));
    });
    this.current = $derived(this.focused && { kind: this.focused.kind, id: this.focused.id });
  }

  register(kind: string, content: WindowContent): this {
    if (this.#contents.has(kind)) throw new Error(`Window kind "${kind}" registered twice`);
    this.#contents.set(kind, content);
    return this;
  }

  content(kind: string): WindowContent | undefined {
    return this.#contents.get(kind);
  }

  /** Title of a window (the focused one without a key). */
  title(key = this.focused?.key): string {
    return (key && this.#titles[key]) || '';
  }

  trailDepth(key: string): number {
    return this.#trailDepths[key] ?? 0;
  }

  /** Whether a window is docked there (the call and the page make room). */
  docked(dock: Exclude<Dock, 'center'>): boolean {
    return this.list.some((w) => w.dock === dock && !w.minimized);
  }

  /** Turns a window into a footer tab. */
  minimize(key: string): void {
    this.#minimizedOrder = [...this.#minimizedOrder.filter((k) => k !== key), key];
    this.write(
      this.list.map((w) => (w.key === key ? { ...w, minimized: true } : w)),
      true,
      key,
    );
  }

  /** Brings a minimized window back to where it was; a window that took that edge meanwhile becomes a tab instead. */
  restore(key: string): void {
    const window = this.list.find((w) => w.key === key);
    if (!window?.minimized) return;
    const taken = window.dock !== 'center' ? this.list.find((w) => w.dock === window.dock && !w.minimized) : undefined;
    if (taken) this.#minimizedOrder = [...this.#minimizedOrder.filter((k) => k !== taken.key), taken.key];
    this.write(
      this.list.map((w) => (w.key === key ? { ...w, minimized: false } : w === taken ? { ...w, minimized: true } : w)),
      true,
      key,
    );
    this.raise(key);
  }

  /** Brings a window (or the call, `WindowService.CALL`) to the top and makes it the focused one. */
  raise(key: string): void {
    if (this.#stack.at(-1) === key) return;
    const live = (k: string) => k === WindowService.CALL || this.list.some((w) => w.key === k);
    this.#stack = [...this.#stack.filter((k) => k !== key && live(k)), key];
  }

  zIndex(key: string): number {
    return WindowService.Z_BASE + Math.max(0, this.#stack.indexOf(key));
  }

  /** Shows a record in the focused window, or a new one when none is open. */
  open(kind: string, id: string): void {
    const window = this.focused;
    if (window) this.show(window.key, kind, id);
    else this.openNew(kind, id, this.dock);
  }

  /** One record back within the focused window (or `key`); closes it when there is none. */
  back(key = this.focused?.key): void {
    if (!key) return;
    const previous = this.#trails.get(key)?.pop();
    this.#trailDepths[key] = this.#trails.get(key)?.length ?? 0;
    if (previous) this.show(key, previous.kind, previous.id);
    else this.close(undefined, key);
  }

  /** Closes the focused window (or `key`); `then` runs once the address no longer names it (going back in history is async). */
  close(then?: () => void, key = this.focused?.key): void {
    if (!key || !this.list.some((w) => w.key === key)) return then?.();
    const answer = this.mayClose();
    if (answer === true) this.closeNow(key, then);
    else if (answer) void answer.then((ok) => ok && this.closeNow(key, then));
  }

  /** Closes the window showing this record, if one does. */
  closeShowing(kind: string, id: string): void {
    const window = this.list.find((w) => w.kind === kind && w.id === id);
    if (window) this.close(undefined, window.key);
  }

  private closeNow(key: string, then?: () => void): void {
    this.setTrail(key, []);
    this.pendingCommand = null;
    if (this.#pushed === key) {
      this.#pushed = null;
      // After the router's own hashchange listener, so `then` sees the address without the window.
      if (then) addEventListener('hashchange', () => then(), { once: true });
      history.back();
    } else {
      this.write(
        this.list.filter((w) => w.key !== key),
        true,
        key,
      );
      then?.();
    }
  }

  /** Moves the focused window (or `key`) to a placement; a window already docked there goes to the middle. */
  setDock(dock: Dock, key = this.focused?.key): void {
    this.dock = dock;
    this.store.set(WindowService.DOCK_KEY, dock);
    if (!key) return;
    this.write(
      this.list.map((w) =>
        w.key === key
          ? { ...w, dock, minimized: false }
          : dock !== 'center' && w.dock === dock && !w.minimized
            ? { ...w, dock: 'center' as const }
            : w,
      ),
      true,
      key,
    );
  }

  setSize(dock: Exclude<Dock, 'center'>, px: number | null): void {
    this.size = { ...this.size, [dock]: px === null ? null : Math.round(px) };
    this.store.set(WindowService.SIZE_KEY, this.size);
  }

  /** A docked size within its limits for this viewport (the page next to it stays usable). */
  static clampSize(dock: Exclude<Dock, 'center'>, px: number, viewport: { width: number; height: number }, limits: ResizeLimits): number {
    const [min, max] =
      dock === 'side' ? [limits.minSidePx, viewport.width - limits.pageMinWidthPx] : [limits.minBottomPx, viewport.height - limits.pageMinHeightPx];
    return Math.max(min, Math.min(px, max));
  }

  private static px(value: unknown): number | null {
    return typeof value === 'number' && value > 0 ? value : null;
  }

  /** A Ctrl/Cmd click or Shift+Enter (the event being handled right now, e.g. `list.openNew`) asks for a new window. */
  static newWindowClick(): boolean {
    const event = (globalThis as { event?: Event }).event;
    if (typeof KeyboardEvent !== 'undefined' && event instanceof KeyboardEvent) return event.key === 'Enter' && event.shiftKey;
    return typeof MouseEvent !== 'undefined' && event instanceof MouseEvent && (event.ctrlKey || event.metaKey);
  }

  /** Handle for the content of one window. */
  handle(key: string): WindowHandle {
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- read by the getter below
    const service = this;
    return {
      setTitle: (title) => (this.#titles[key] = title),
      close: (then) => this.close(then, key),
      open: (kind, id) => {
        if (WindowService.newWindowClick()) return this.raise(this.openNew(kind, id, this.dock));
        const window = this.list.find((w) => w.key === key);
        if (window) this.setTrail(key, [...(this.#trails.get(key) ?? []), { kind: window.kind, id: window.id }]);
        this.show(key, kind, id);
      },
      replace: (kind, id) => this.show(key, kind, id),
      navigate: (path) => {
        this.#pushed = null;
        this.router.navigate(this.carry(path, key));
      },
      get focused() {
        return service.focused?.key === key;
      },
    };
  }

  /** `path` with the open windows (but `without`) added, so they stay open on that page. */
  carry(path: string, without?: string): string {
    const entries = this.entries(this.list.filter((w) => w.key !== without));
    if (!entries.length) return path;
    const [page, query = ''] = path.split('?');
    const params = new URLSearchParams(query);
    params.delete(WindowService.PARAM);
    for (const entry of entries) params.append(WindowService.PARAM, entry);
    return `${page}?${params}`;
  }

  /** The windows stay open on another page: closing one must not go back in history to the old page. */
  keepAcrossNavigation(): void {
    this.#pushed = null;
  }

  private openFromOutside({ kind, id, dock, command, newWindow }: WindowTarget & { dock?: Dock; command?: CommandId; newWindow?: boolean }): void {
    const shown = this.list.find((w) => w.kind === kind && w.id === id);
    let key: string;
    if (shown) {
      key = shown.key;
      if (dock && dock !== shown.dock) this.setDock(dock, key);
      else this.restore(key);
    } else {
      const focused = this.focused;
      const reuse =
        newWindow || WindowService.newWindowClick()
          ? undefined
          : !dock
            ? focused
            : dock === 'center'
              ? focused?.dock === 'center'
                ? focused
                : undefined
              : this.list.find((w) => w.dock === dock && !w.minimized);
      if (reuse) {
        // Opening from outside starts a fresh window history.
        this.setTrail(reuse.key, []);
        this.show(reuse.key, kind, id);
        key = reuse.key;
      } else key = this.openNew(kind, id, dock ?? this.dock);
    }
    this.raise(key);
    this.pendingCommand = command ? { kind, id, command } : null;
  }

  /** A new window as a new history entry (Back closes it), in the middle when `dock` is taken; returns its key. */
  private openNew(kind: string, id: string, dock: Dock): string {
    const place = dock !== 'center' && this.docked(dock) ? 'center' : dock;
    this.write([...this.list, { key: '', kind, id, dock: place, minimized: false }], false, null);
    const key = this.list.at(-1)!.key;
    this.#pushed = key;
    return key;
  }

  /** Another record in a window; replaces its entry, so Back still closes it in one step. */
  private show(key: string, kind: string, id: string): void {
    const window = this.list.find((w) => w.key === key);
    if (!window || (window.kind === kind && window.id === id)) return;
    this.#titles[key] = '';
    this.write(
      this.list.map((w) => (w.key === key ? { ...w, kind, id } : w)),
      true,
      key,
    );
  }

  /**
   * Writes the windows to the URL; a change to any but the pushed window means Back no longer only closes that one.
   * A tab whose record a shown window now shows (opened another way) closes.
   */
  private write(windows: readonly OpenWindow[], replace: boolean, touched: string | null): void {
    if (touched !== this.#pushed) this.#pushed = null;
    const shown = windows.filter((w) => !w.minimized);
    const kept = windows.filter((w) => !w.minimized || !shown.some((s) => s.kind === w.kind && s.id === w.id));
    this.router.updateQuery({ [WindowService.PARAM]: this.entries(kept) }, replace);
  }

  private entries(windows: readonly OpenWindow[]): string[] {
    return windows.map((w) => `${w.kind}/${encodeURIComponent(w.id)}@${w.dock}${w.minimized ? '.min' : ''}`);
  }

  private setTrail(key: string, trail: WindowTarget[]): void {
    this.#trails.set(key, trail);
    this.#trailDepths[key] = trail.length;
  }

  /**
   * The URL's windows with their keys: an unchanged entry keeps its key, a changed one (other record or dock) keeps the
   * key of the entry at its position, the rest are new. Only one window per edge (later ones go to the middle).
   */
  private reconcile(raw: readonly string[]): readonly OpenWindow[] {
    const parsed = raw.map((value) => this.parse(value)).filter((w) => w !== null);
    const previous = this.#previous;
    const used = new Set<OpenWindow>();
    const same = parsed.map((p) => {
      const match = previous.find((w) => !used.has(w) && w.kind === p.kind && w.id === p.id && w.dock === p.dock && w.minimized === p.minimized);
      if (match) used.add(match);
      return match;
    });
    const edges = new Set<Dock>();
    const next = parsed.map((p, i): OpenWindow => {
      let window = same[i];
      if (!window) {
        const at = previous[i];
        const key = at && !used.has(at) ? at.key : `w${++this.#nextKey}`;
        if (at) used.add(at);
        window = { ...p, key };
      }
      if (window.minimized) return window;
      if (window.dock !== 'center' && edges.has(window.dock)) window = { ...window, dock: 'center' };
      edges.add(window.dock);
      return window;
    });
    // Windows gone (closed, or Back/Forward without this service) forget their trail and the pushed entry.
    for (const gone of previous.filter((w) => !next.some((n) => n.key === w.key))) {
      this.#trails.delete(gone.key);
      if (this.#pushed === gone.key) this.#pushed = null;
    }
    this.#previous = next;
    return next;
  }

  private parse(raw: string): Omit<OpenWindow, 'key'> | null {
    const slash = raw.indexOf('/');
    if (slash <= 0) return null;
    const kind = raw.slice(0, slash);
    // The id is encoded, so a raw "@" only comes from the dock suffix (links without one open in the remembered placement).
    const at = raw.lastIndexOf('@');
    const suffix = at > slash ? raw.slice(at + 1) : null;
    const [place, state] = (suffix ?? '').split('.');
    const dock = DOCKS.includes(place as Dock) ? (place as Dock) : this.dock;
    const id = Router.decode(raw.slice(slash + 1, suffix ? at : undefined));
    if (id === null) return null;
    const content = this.#contents.get(kind);
    const allowed = !!content && (!content.roles || this.hasRole(content.roles)) && (!content.canOpen || content.canOpen(id));
    return id && allowed ? { kind, id, dock, minimized: state === 'min' } : null;
  }
}
