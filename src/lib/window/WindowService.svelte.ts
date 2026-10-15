import type { Component } from 'svelte';
import type { Router } from '../router/Router.svelte';
import type { LocalStore } from '../storage/LocalStore';

export type Dock = 'center' | 'side' | 'bottom';

export const DOCKS: readonly Dock[] = ['center', 'side', 'bottom'];

/** What a window shows: a registered content kind plus the record id. */
export interface WindowTarget {
  kind: string;
  id: string;
}

/** Given to window contents so they can talk to their window. */
export interface WindowHandle {
  setTitle(title: string): void;
  close(): void;
  /** Replaces the content (e.g. after creating a record, show it). */
  open(kind: string, id: string): void;
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
}

/**
 * The single detail window of the app. Its target lives in the URL (`?open=kind/id`), so reload keeps
 * it, links can be shared and Back closes it. The dock placement is remembered per browser.
 */
export class WindowService {
  static readonly PARAM = 'open';
  private static readonly DOCK_KEY = 'window-dock';

  dock = $state<Dock>('center');
  title = $state('');
  readonly current: WindowTarget | null;

  readonly #contents = new Map<string, WindowContent>();
  /** True while the open entry was pushed by this service, so closing can go back instead of piling up history. */
  #pushed = false;

  constructor(
    private readonly router: Router,
    private readonly store: LocalStore,
    defaultDock: Dock,
  ) {
    const stored = store.get<Dock>(WindowService.DOCK_KEY);
    this.dock = stored && DOCKS.includes(stored) ? stored : defaultDock;
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

  close(): void {
    if (!this.current) return;
    if (this.#pushed) {
      this.#pushed = false;
      history.back();
    } else {
      this.router.updateQuery({ [WindowService.PARAM]: null }, true);
    }
  }

  setDock(dock: Dock): void {
    this.dock = dock;
    this.store.set(WindowService.DOCK_KEY, dock);
  }

  /** Handle for the content currently shown. */
  handle(): WindowHandle {
    return {
      setTitle: (title) => (this.title = title),
      close: () => this.close(),
      open: (kind, id) => this.open(kind, id),
      navigate: (path) => {
        this.#pushed = false;
        this.router.navigate(path);
      },
    };
  }

  /** Called when history moved without this service (Back/Forward): the pushed entry is gone. */
  forgetPush(): void {
    this.#pushed = false;
  }

  private parse(raw: string | null): WindowTarget | null {
    if (!raw) return null;
    const slash = raw.indexOf('/');
    if (slash <= 0) return null;
    const kind = raw.slice(0, slash);
    const id = decodeURIComponent(raw.slice(slash + 1));
    return id && this.#contents.has(kind) ? { kind, id } : null;
  }
}
