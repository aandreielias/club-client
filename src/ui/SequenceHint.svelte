<script lang="ts">
  import { SHORTCUTS } from '../shortcuts';
  import { keyboard } from '../lib/container';
  import { KeySpec } from '../lib/keyboard/KeySpec';
  import Kbd from './Kbd.svelte';

  /** After the first key of a sequence (e.g. G): which keys can follow and what they do. */
  const next = $derived(keyboard.pending.length ? keyboard.nextSteps() : []);
</script>

{#if next.length}
  <div class="hint" role="status">
    <span class="prefix">{KeySpec.text(keyboard.pending.join(' '), keyboard.isMac)}, dann</span>
    <ul>
      {#each next as option (option.id)}
        <li><Kbd keys={option.next} /> {SHORTCUTS[option.id].label}</li>
      {/each}
    </ul>
  </div>
{/if}

<style>
  .hint {
    position: fixed;
    left: calc(var(--layout-sidebar-width) + var(--space-lg));
    bottom: var(--space-lg);
    z-index: 45;
    display: grid;
    gap: var(--space-xs);
    max-width: 320px;
    padding: var(--space-sm) var(--space-md);
    border-radius: var(--radius-md);
    background: var(--color-background);
    box-shadow: var(--color-shadow-popover);
    font-size: var(--font-size-small);
  }
  :global([data-layout='compact']) .hint {
    left: var(--space-lg);
  }
  .prefix {
    color: var(--color-text-muted);
  }
  ul {
    display: grid;
    gap: 2px;
  }
  li {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }
</style>
