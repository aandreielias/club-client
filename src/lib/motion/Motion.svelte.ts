import { expoOut, cubicInOut } from 'svelte/easing';
import { tick } from 'svelte';
import { MediaQuery } from 'svelte/reactivity';
import type { TransitionConfig } from 'svelte/transition';
import type { Settings } from '../../settings';

type Origin = 'top' | 'bottom' | 'left' | 'right' | 'center';

/**
 * Script-side motion: Svelte transition presets that share the CSS timing (settings.motion) and
 * collapse to nothing when the device or the member asks for reduced motion.
 */
export class Motion {
  readonly #system = new MediaQuery('(prefers-reduced-motion: reduce)', false);

  constructor(
    private readonly timing: Settings['motion'],
    /** The member's own "Weniger Bewegung" preference. */
    private readonly preferReduced: () => boolean,
  ) {}

  get reduced(): boolean {
    return this.#system.current || this.preferReduced();
  }

  /** Duration in ms, 0 when motion is reduced. */
  ms(kind: 'fast' | 'base' | 'slow' | 'window'): number {
    return this.reduced ? 0 : this.timing[kind];
  }

  /** Delay for the n-th item of a list that enters one after another (capped). */
  stagger(index: number): number {
    return this.reduced ? 0 : Math.min(index, this.timing.staggerMax) * this.timing.staggerMs;
  }

  /** Fades in while rising a few pixels: content, list rows, toasts. */
  rise = (_node: Element, { delay = 0, distance = this.timing.rise }: { delay?: number; distance?: number } = {}): TransitionConfig => ({
    delay,
    duration: this.ms('slow'),
    easing: expoOut,
    css: (t, u) => `opacity: ${t}; transform: translateY(${u * distance}px);`,
  });

  /** Pops from its anchor: menus, tooltips, dialogs, the palette. */
  pop = (_node: Element, { origin = 'top' }: { origin?: Origin } = {}): TransitionConfig => {
    const shift = { top: [0, -4], bottom: [0, 4], left: [-4, 0], right: [4, 0], center: [0, 0] }[origin];
    return {
      duration: this.ms('base'),
      easing: expoOut,
      css: (t, u) => `opacity: ${t}; transform: translate(${u * shift[0]}px, ${u * shift[1]}px) scale(${0.97 + 0.03 * t});`,
    };
  };

  /** Slides in from an edge by its own size: docked windows, the compact sidebar. */
  slide = (_node: Element, { from = 'right' }: { from?: 'right' | 'bottom' | 'left' } = {}): TransitionConfig => {
    const axis = from === 'bottom' ? 'Y' : 'X';
    const sign = from === 'left' ? -1 : 1;
    return {
      duration: this.ms('window'),
      easing: expoOut,
      css: (t, u) => `opacity: ${0.4 + 0.6 * t}; transform: translate${axis}(${sign * u * 100}%);`,
    };
  };

  /** Plain cross-fade: backdrops. */
  fade = (_node?: Element): TransitionConfig => ({ duration: this.ms('base'), easing: cubicInOut, css: (t) => `opacity: ${t};` });

  /** Runs a DOM change as a View Transition where supported (page changes), otherwise directly. */
  transition(change: () => void): void {
    const start = (document as Document & { startViewTransition?: (cb: () => Promise<void>) => unknown }).startViewTransition;
    if (this.reduced || !start) return change();
    // The callback resolves after Svelte has rendered the new page, so the browser captures it.
    const transition = start.call(document, async () => {
      change();
      await tick();
    }) as { ready: Promise<void>; finished: Promise<void> };
    // A transition aborted by the browser (e.g. a second navigation right away) only skips the animation; the change still ran.
    transition.ready.catch(() => {});
    transition.finished.catch(() => {});
  }
}
