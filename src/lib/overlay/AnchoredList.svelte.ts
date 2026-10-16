import { tick } from 'svelte';
import { dropdownPosition } from './placement';

/**
 * The open/close part of a dropdown (Select, SearchSelect): a popover list under its anchor field,
 * placed in the viewport and closed by a pointer press outside of both.
 */
export class AnchoredList {
  static readonly MAX_HEIGHT = 280;
  static readonly MIN_WIDTH = 160;
  static readonly GAP = 4;

  open = $state(false);

  constructor(
    private readonly anchor: () => HTMLElement | undefined,
    private readonly list: () => HTMLElement | undefined,
    /** A press outside closes the list; the owner decides what else happens. */
    private readonly onoutside: () => void,
    /** 'match': as wide as the anchor; 'min': at least as wide. */
    private readonly width: 'match' | 'min',
  ) {}

  /** Opens the list; false when it was open already or is not rendered yet. */
  show(): boolean {
    const list = this.list();
    if (this.open || !list || !this.anchor()) return false;
    this.open = true;
    list.showPopover();
    this.place();
    document.addEventListener('pointerdown', this.#outside, true);
    return true;
  }

  /** Closes the list; false when it was closed already. */
  hide(): boolean {
    if (!this.open) return false;
    this.open = false;
    const list = this.list();
    if (list?.matches(':popover-open')) list.hidePopover();
    document.removeEventListener('pointerdown', this.#outside, true);
    return true;
  }

  place(): void {
    const anchor = this.anchor();
    const list = this.list();
    if (!anchor || !list) return;
    const rect = anchor.getBoundingClientRect();
    const height = Math.min(list.scrollHeight || AnchoredList.MAX_HEIGHT, AnchoredList.MAX_HEIGHT);
    const at = dropdownPosition(rect, height, AnchoredList.MIN_WIDTH, { width: innerWidth, height: innerHeight }, AnchoredList.GAP);
    list.style[this.width === 'match' ? 'width' : 'minWidth'] = `${rect.width}px`;
    list.style.left = `${this.width === 'match' ? rect.left : at.x}px`;
    list.style.top = `${at.y}px`;
  }

  /** Keeps the active option (data-active) visible after the list changed. */
  scrollActive(): void {
    void tick().then(() => this.list()?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }));
  }

  readonly #outside = (event: PointerEvent) => {
    const target = event.target as Node;
    if (!this.list()?.contains(target) && !this.anchor()?.contains(target)) this.onoutside();
  };
}
