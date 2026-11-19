import type { LocalStore } from '../../lib/storage/LocalStore';
import type { WindowService } from '../../lib/window/WindowService.svelte';
import { CallSession } from './CallSession.svelte';
import type { MeetingsApi } from './MeetingsApi';

export type CallPlacement = 'center' | 'side' | 'bottom';
/** Where the call is drawn: its placement, or the left edge (next to the collapsed sidebar) when the detail window holds that edge. */
export type CallDock = CallPlacement | 'left';
export type CallLayout = 'gallery' | 'speaker';
interface CallSizes {
  side: number | null;
  bottom: number | null;
}

/**
 * The one video call the member is in, app-wide: it keeps running while they move through the app, in a floating window
 * placed like the detail window (middle, side, bottom), minimized to a bar along the bottom. Placement, layout and sizes
 * are remembered per browser.
 */
export class CallService {
  private static readonly KEY = 'call-window';

  session = $state.raw<CallSession | null>(null);
  meeting = $state<{ id: string; title: string } | null>(null);
  placement = $state<CallPlacement>('center');
  layout = $state<CallLayout>('gallery');
  size = $state<CallSizes>({ side: null, bottom: null });
  minimized = $state(false);
  error = $state<unknown>(null);
  /** The edge a drag would dock the call to when released now (its preview shows, CallWindow). */
  snap = $state<CallPlacement | null>(null);

  constructor(
    private readonly api: MeetingsApi,
    private readonly windows: WindowService,
    private readonly store: LocalStore,
  ) {
    const saved = store.get<{ placement?: CallPlacement; layout?: CallLayout; size?: CallSizes }>(CallService.KEY);
    if (saved?.placement && ['center', 'side', 'bottom'].includes(saved.placement)) this.placement = saved.placement;
    if (saved?.layout === 'speaker') this.layout = 'speaker';
    if (saved?.size) this.size = { side: saved.size.side ?? null, bottom: saved.size.bottom ?? null };
  }

  /** In a call right now (joined, not just connecting). */
  get active(): boolean {
    return !!this.session?.joined;
  }

  /** The detail window docked at the bottom leaves no room for the call there. */
  get bottomTaken(): boolean {
    return !!this.windows.current && this.windows.dock === 'bottom';
  }

  /** The detail window docked at the side: the call's side placement takes the left edge. */
  get sideTaken(): boolean {
    return !!this.windows.current && this.windows.dock === 'side';
  }

  /** The call holds the left edge, or its drag preview does: the sidebar collapses meanwhile. */
  get takesLeft(): boolean {
    const docked = !!this.session && !this.minimized && this.dock === 'left';
    return docked || (!!this.snap && this.dockFor(this.snap) === 'left');
  }

  /** Same edge as the docked detail window: the call takes the left edge instead. */
  get dock(): CallDock {
    return this.dockFor(this.placement);
  }

  /** Where a placement would be drawn now (the snap preview while dragging). */
  dockFor(placement: CallPlacement): CallDock {
    if (placement === 'center') return 'center';
    return this.windows.current && this.windows.dock === placement ? 'left' : placement;
  }

  /** Joins a meeting's call, leaving another one first; the same meeting only brings the window back. */
  async join(meeting: { id: string; title: string }): Promise<void> {
    if (this.active && this.meeting?.id === meeting.id) {
      this.minimized = false;
      return;
    }
    await this.leave();
    const session = new CallSession(this.api, meeting.id, (error) => (this.error = error));
    this.session = session;
    this.meeting = meeting;
    this.minimized = false;
    this.error = null;
    try {
      await session.join();
    } catch (error) {
      await this.leave();
      throw error;
    }
  }

  /** `notify` false when the page goes away and the server forgets the member anyway. */
  async leave(notify = true): Promise<void> {
    const session = this.session;
    this.session = null;
    this.meeting = null;
    await session?.leave(notify);
  }

  place(placement: CallPlacement): void {
    this.placement = placement;
    this.minimized = false;
    this.save();
  }

  setLayout(layout: CallLayout): void {
    this.layout = layout;
    this.save();
  }

  setSize(edge: keyof CallSizes, px: number | null): void {
    this.size = { ...this.size, [edge]: px === null ? null : Math.round(px) };
    this.save();
  }

  private save(): void {
    this.store.set(CallService.KEY, { placement: this.placement, layout: this.layout, size: this.size });
  }
}
