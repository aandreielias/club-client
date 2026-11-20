<script lang="ts">
  import { documentTitle, windows } from '../lib/container';
  import { WindowService } from '../lib/window/WindowService.svelte';
  import { innerHeight, innerWidth } from 'svelte/reactivity/window';
  import { settings } from '../settings';
  import DetailWindow from './DetailWindow.svelte';
  import WindowTabs from './WindowTabs.svelte';

  /** Renders the open detail windows (one per URL entry) and tells the page where they are docked. */
  const viewport = $derived({ width: innerWidth.current ?? 0, height: innerHeight.current ?? 0 });

  // Reflect the windows on <html> so the page can make room (App.svelte) and print only the focused one.
  $effect(() => {
    const root = document.documentElement.dataset;
    const flags = { window: windows.list.length > 0, windowSide: windows.docked('side'), windowBottom: windows.docked('bottom') };
    for (const [name, on] of Object.entries(flags)) {
      if (on) root[name] = '';
      else delete root[name];
    }
    return () => Object.keys(flags).forEach((name) => delete root[name]);
  });

  // A dragged size overrides the theme's docked width/height; the page margins (App.svelte) follow.
  $effect(() => {
    const style = document.documentElement.style;
    for (const [dock, property] of [
      ['side', '--window-side-width'],
      ['bottom', '--window-bottom-height'],
    ] as const) {
      const px = windows.size[dock];
      if (px === null) style.removeProperty(property);
      else style.setProperty(property, `${WindowService.clampSize(dock, px, viewport, settings.window.resize)}px`);
    }
  });

  $effect(() => {
    documentTitle.window = windows.title();
  });
</script>

{#each windows.list as win (win.key)}
  <DetailWindow {win} />
{/each}
<WindowTabs />
