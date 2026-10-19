<script lang="ts">
  import type { Snippet } from 'svelte';
  import { WINDOW_OPEN } from '../channels';
  import { bus } from '../lib/container';
  import { RecordDrag } from '../lib/records/RecordDrag';
  import { tooltip } from './tooltip';
  import { windowHandle } from './windowContext';

  /**
   * A name that opens its record in the window: inside a window with a way back, elsewhere fresh.
   * Without `allowed` it renders as plain text, so records the member may not open never look clickable.
   */
  let {
    kind,
    id,
    allowed = true,
    hint,
    onopen,
    children,
  }: { kind: string; id: string; allowed?: boolean; hint?: string; onopen?: () => void; children: Snippet } = $props();

  const handle = windowHandle();

  function open(event: MouseEvent) {
    event.stopPropagation(); // rows and chips around it have their own click
    if (onopen) onopen();
    else if (handle) handle.open(kind, id);
    else bus.publish(WINDOW_OPEN, { kind, id });
  }
</script>

{#if allowed}
  <button type="button" class="record-link" onclick={open} draggable="true"
    ondragstart={(e) => RecordDrag.set(e, { kind, id, title: (e.currentTarget as HTMLElement).textContent?.trim() ?? '' })} {@attach tooltip(hint ?? 'Öffnen')}>{@render children()}</button>
{:else}
  <span class="record-text">{@render children()}</span>
{/if}

<style>
  .record-link {
    display: inline-flex;
    align-items: center;
    max-width: 100%;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    text-decoration: underline;
    text-decoration-color: var(--color-border-strong);
    text-underline-offset: 3px;
    cursor: pointer;
    transition:
      color var(--motion-fast),
      text-decoration-color var(--motion-fast);
  }
  .record-link:hover {
    color: var(--color-accent);
    text-decoration-color: currentColor;
  }
</style>
