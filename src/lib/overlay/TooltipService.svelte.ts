export interface Tooltip {
  id: string;
  text: string;
  anchor: DOMRect;
}

/**
 * The one tooltip of the app: shows after a hover delay (at once on keyboard focus and while
 * "warm", right after another tooltip), hides on leave, blur, scroll or Escape.
 */
export class TooltipService {
  static readonly ID = 'app-tooltip';

  current = $state.raw<Tooltip | null>(null);

  #timer: ReturnType<typeof setTimeout> | undefined;
  #warmUntil = 0;
  #owner: Element | null = null;

  constructor(
    private readonly delayMs: number,
    private readonly skipDelayMs: number,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** `immediate` for keyboard focus. */
  show(owner: Element, text: string, immediate = false): void {
    clearTimeout(this.#timer);
    this.#owner = owner;
    const open = () => {
      if (this.#owner !== owner || !owner.isConnected) return;
      this.current = { id: TooltipService.ID, text, anchor: owner.getBoundingClientRect() };
      owner.setAttribute('aria-describedby', TooltipService.ID);
    };
    if (immediate || this.current || this.now() < this.#warmUntil) open();
    else this.#timer = setTimeout(open, this.delayMs);
  }

  /** Hides the tooltip of `owner` (or any tooltip without an owner). */
  hide(owner?: Element): void {
    if (owner && owner !== this.#owner) return;
    clearTimeout(this.#timer);
    if (this.current) this.#warmUntil = this.now() + this.skipDelayMs;
    if (this.#owner?.getAttribute('aria-describedby') === TooltipService.ID) this.#owner.removeAttribute('aria-describedby');
    this.current = null;
    this.#owner = null;
  }

  isOwner(owner: Element): boolean {
    return this.#owner === owner && this.current !== null;
  }
}
