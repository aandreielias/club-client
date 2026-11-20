import type { Pane } from '../split/Pane';
import type { SplitView } from '../split/SplitView.svelte';

/**
 * Switching pages from the sidebar and the navigation shortcuts. In the split view only the pane last
 * used changes, the split stays; open windows stay open (docked and in the middle).
 */
export class PageNavigator {
  constructor(
    private readonly split: SplitView,
    private readonly main: Pane,
    private readonly second: Pane,
  ) {}

  go(path: string): void {
    // The second pane's location is its own URL parameter: `open` stays untouched.
    if (this.split.isOpen && this.split.focused === 'split') return this.second.navigate(path);
    this.main.navigate(path); // keeps the open windows
  }
}
