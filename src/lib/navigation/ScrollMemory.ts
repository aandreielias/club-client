/**
 * Remembers how far each page was scrolled and returns there when the page is shown again (Back,
 * sidebar). Lists load after the page renders, so restoring waits briefly until the page is tall enough.
 */
export class ScrollMemory {
  readonly #positions = new Map<string, number>();
  #frame = 0;

  constructor(private readonly patienceMs: number) {}

  /** Keeps the current page's position while the user scrolls. */
  remember(path: string, y: number): void {
    this.#positions.set(path, y);
  }

  position(path: string): number {
    return this.#positions.get(path) ?? 0;
  }

  /** After a page change: scroll to its remembered position (or the top). */
  restore(path: string, scrollTo: (y: number) => void = (y) => window.scrollTo(0, y)): void {
    cancelAnimationFrame(this.#frame);
    const target = this.position(path);
    const until = performance.now() + this.patienceMs;
    const attempt = () => {
      const reachable = document.documentElement.scrollHeight - window.innerHeight >= target;
      if (reachable || performance.now() > until) scrollTo(target);
      else this.#frame = requestAnimationFrame(attempt);
    };
    this.#frame = requestAnimationFrame(attempt);
  }
}
