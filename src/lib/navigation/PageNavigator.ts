import type { Pane } from '../split/Pane';
import type { SplitView } from '../split/SplitView.svelte';
import type { WindowService } from '../window/WindowService.svelte';

/**
 * Switching pages from the sidebar and the navigation shortcuts. In the split view only the pane last
 * used changes, the split stays; a window docked at the side or bottom stays open (a centered one,
 * which covers the page, closes as before).
 */
export class PageNavigator {
  constructor(
    private readonly split: SplitView,
    private readonly main: Pane,
    private readonly second: Pane,
    private readonly windows: Pick<WindowService, 'current' | 'dock' | 'keepAcrossNavigation'>,
  ) {}

  go(path: string): void {
    // The second pane's location is its own URL parameter: `open` stays untouched.
    if (this.split.isOpen && this.split.focused === 'split') return this.second.navigate(path);
    const open = this.main.query.get('open');
    if (!open || !this.windows.current || this.windows.dock === 'center') return this.main.navigate(path);
    this.windows.keepAcrossNavigation();
    const [page, query = ''] = path.split('?');
    const params = new URLSearchParams(query);
    params.set('open', open);
    this.main.navigate(`${page}?${params}`);
  }
}
