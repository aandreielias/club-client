import { tick } from 'svelte';
import { SafeTriangle } from '../lib/navigation/SafeTriangle';
import { settings } from '../settings';

/**
 * The open group flyout of the sidebar: opens on hover or focus, closes shortly after the pointer leaves (so it can move into it).
 * Menu aim: while the pointer heads diagonally for the open flyout it crosses other rows; they wait (`aimNext`) until it stops or
 * turns away.
 */
export class SidebarFlyout {
  /** The group whose flyout is open. */
  key = $state<string | null>(null);
  #closing: ReturnType<typeof setTimeout> | undefined;
  #aim: SafeTriangle | null = null;
  #aimNext: string | null = null;

  /** {@code compact}: no hover in the phone layout, the tabs stay listed below their group. */
  constructor(private readonly compact: () => boolean) {}

  show(key: string): void {
    if (this.#aim && key !== this.key) {
      this.#aimNext = key;
      return;
    }
    this.#stopAim();
    clearTimeout(this.#closing);
    this.key = key;
  }

  close(delay: number = settings.overlay.flyoutCloseDelayMs): void {
    clearTimeout(this.#closing);
    this.#closing = setTimeout(() => {
      const next = this.#aimNext;
      this.#stopAim();
      this.key = next;
    }, delay);
  }

  leaveGroup(event: PointerEvent, key: string): void {
    if (key !== this.key) {
      if (this.#aimNext === key) this.#aimNext = null;
      return;
    }
    const box = document.querySelector(`[data-flyout="${key}"]`)?.getBoundingClientRect();
    if (!box || this.compact()) return this.close();
    this.#aim = new SafeTriangle({ x: event.clientX, y: event.clientY }, box);
    window.addEventListener('pointermove', this.#aiming);
    this.close(settings.overlay.flyoutAimMs);
  }

  /** Focus left the group and its flyout. */
  leaveFocus(event: FocusEvent): void {
    if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node)) this.close(0);
  }

  /** On the group row: right arrow or space opens the flyout on its first tab. */
  groupKeys(event: KeyboardEvent, key: string): void {
    if (event.key === 'ArrowRight' || event.key === ' ') {
      event.preventDefault();
      this.show(key);
      void tick().then(() => document.querySelector<HTMLElement>(`[data-flyout="${key}"] a`)?.focus());
    }
  }

  /** In the flyout: up and down move between tabs, escape and left arrow return to the group row. */
  flyoutKeys(event: KeyboardEvent, key: string): void {
    const links = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('a')];
    const index = links.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      links[(index + (event.key === 'ArrowDown' ? 1 : links.length - 1)) % links.length]?.focus();
    } else if (event.key === 'Escape' || event.key === 'ArrowLeft') {
      event.preventDefault();
      event.stopPropagation();
      this.key = null;
      document.querySelector<HTMLElement>(`[data-group="${key}"]`)?.focus();
    }
  }

  dispose(): void {
    clearTimeout(this.#closing);
    this.#stopAim();
  }

  readonly #aiming = (event: PointerEvent): void => {
    // Still heading there: keep it open, a pause of flyoutAimMs from now ends the aim.
    if (this.#aim?.contains({ x: event.clientX, y: event.clientY })) return this.close(settings.overlay.flyoutAimMs);
    const next = this.#aimNext;
    this.#stopAim();
    if (next) this.show(next);
    else this.close(0);
  };

  #stopAim(): void {
    this.#aim = null;
    this.#aimNext = null;
    window.removeEventListener('pointermove', this.#aiming);
  }
}
