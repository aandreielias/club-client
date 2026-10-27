import type { Component } from 'svelte';
import { defineEvent, type EventBus } from '../bus';
import { Router } from '../router/Router.svelte';
import type { LocalStore } from '../storage/LocalStore';
import type { Role } from '../types';

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

/** Opens a record in the window, optionally moving the window to `dock` first. */
export const WINDOW_OPEN = defineEvent<WindowTarget & { dock?: Dock }>('ui/window/open');
export const WINDOW_CLOSE = defineEvent('ui/window/close');

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
}

export interface WindowContentProps {
  id: string;
  handle: WindowHandle;
}

export interface WindowContent {
  component: Component<WindowContentProps>;
  /** Full-page route for "Als Seite öffnen"; omitted when there is none. */
  page?: (id: string) => string;
  /** Only members with one of these roles may open it; others see no window (also via links). */
  roles?: readonly Role[];
  /** Finer check per record (e.g. coaches see only their teams' members); read reactively. */
  canOpen?: (id: string) => boolean;
}

/**
 * The single detail window of the app. Its target lives in the URL (`?open=kind/id`), so reload keeps
 * it, links can be shared and Back closes it. The dock placement is remembered per browser.
 */
export class WindowService {
  static readonly PARAM = 'open';
  private static readonly DOCK_KEY = 'window-dock';
  private static readonly SIZE_KEY = 'window-size';

  dock = $state<Dock>('center');
  /** Docked width (side) and height (bottom) in px, dragged at the inner edge; null keeps the theme's default. */
  size = $state<DockSizes>({ side: null, bottom: null });
  title = $state('');
  readonly current: WindowTarget | null;

  readonly #contents = new Map<string, WindowContent>();
  /** Records shown before the current one in this window, oldest first (opened from inside the window). */
  readonly #trail: WindowTarget[] = [];
  trailDepth = $state(0);
  /** True while the open entry was pushed by this service, so closing can go back instead of piling up history. */
  #pushed = false;

  constructor(
    private readonly router: Router,
    private readonly store: LocalStore,
    defaultDock: Dock,
    bus: EventBus,
    /** Asked before the window closes (unsaved changes); false keeps it open. */
    private readonly mayClose: () => boolean | Promise<boolean> = () => true,
    /** Role check of the signed-in member. */
    private readonly hasRole: (roles: readonly Role[]) => boolean = () => true,
  ) {
    // Opening from outside (lists, calendar, links) starts a fresh window history.
    bus.subscribe(WINDOW_OPEN, ({ kind, id, dock }) => {
      if (dock) this.setDock(dock);
      this.setTrail([]);
      this.open(kind, id);
    });
    bus.subscribe(WINDOW_CLOSE, () => this.close());
    const stored = store.get<Dock>(WindowService.DOCK_KEY);
    this.dock = stored && DOCKS.includes(stored) ? stored : defaultDock;
    const sizes = store.get<Partial<DockSizes>>(WindowService.SIZE_KEY);
    this.size = { side: WindowService.px(sizes?.side), bottom: WindowService.px(sizes?.bottom) };
    this.current = $derived(this.parse(this.router.query.get(WindowService.PARAM)));
  }

  register(kind: string, content: WindowContent): this {
    if (this.#contents.has(kind)) throw new Error(`Window kind "${kind}" registered twice`);
    this.#contents.set(kind, content);
    return this;
  }

  content(kind: string): WindowContent | undefined {
    return this.#contents.get(kind);
  }

  open(kind: string, id: string): void {
    const value = `${kind}/${encodeURIComponent(id)}`;
    if (this.router.query.get(WindowService.PARAM) === value) return;
    this.title = '';
    // Switching between records replaces the entry, so Back still closes the window in one step.
    const replace = this.current !== null;
    this.router.updateQuery({ [WindowService.PARAM]: value }, replace);
    if (!replace) this.#pushed = true;
  }

  /** One record back within the window; closes it when there is none. */
  back(): void {
    const previous = this.#trail.pop();
    this.trailDepth = this.#trail.length;
    if (previous) this.open(previous.kind, previous.id);
    else this.close();
  }

  /** `then` runs once the address no longer names the window (closing may go back in history, which is async). */
  close(then?: () => void): void {
    if (!this.current) return then?.();
    const answer = this.mayClose();
    if (answer === true) this.closeNow(then);
    else if (answer) void answer.then((ok) => ok && this.closeNow(then));
  }

  private closeNow(then?: () => void): void {
    this.setTrail([]);
    if (!this.current) return then?.();
    if (this.#pushed) {
      this.#pushed = false;
      // After the router's own hashchange listener, so `then` sees the address without the window.
      if (then) addEventListener('hashchange', () => then(), { once: true });
      history.back();
    } else {
      this.router.updateQuery({ [WindowService.PARAM]: null }, true);
      then?.();
    }
  }

  setDock(dock: Dock): void {
    this.dock = dock;
    this.store.set(WindowService.DOCK_KEY, dock);
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

  /** Handle for the content currently shown. */
  handle(): WindowHandle {
    return {
      setTitle: (title) => (this.title = title),
      close: (then) => this.close(then),
      open: (kind, id) => {
        if (this.current) this.setTrail([...this.#trail, this.current]);
        this.open(kind, id);
      },
      replace: (kind, id) => this.open(kind, id),
      navigate: (path) => {
        this.#pushed = false;
        this.router.navigate(path);
      },
    };
  }

  /** The window stays open on another page: closing it must not go back in history to the old page. */
  keepAcrossNavigation(): void {
    this.#pushed = false;
  }

  /** Called when history moved without this service (Back/Forward): the pushed entry is gone. */
  forgetPush(): void {
    this.#pushed = false;
    this.setTrail([]);
  }

  private setTrail(trail: WindowTarget[]): void {
    this.#trail.splice(0, this.#trail.length, ...trail);
    this.trailDepth = trail.length;
  }

  private parse(raw: string | null): WindowTarget | null {
    if (!raw) return null;
    const slash = raw.indexOf('/');
    if (slash <= 0) return null;
    const kind = raw.slice(0, slash);
    const id = Router.decode(raw.slice(slash + 1));
    if (id === null) return null;
    const content = this.#contents.get(kind);
    const allowed = !!content && (!content.roles || this.hasRole(content.roles)) && (!content.canOpen || content.canOpen(id));
    return id && allowed ? { kind, id } : null;
  }
}
