<script lang="ts">
  import { keyboard } from '../lib/container';
  import { KeySpec } from '../lib/keyboard/KeySpec';

  /** Keycaps of a key spec, e.g. [Strg][K] or [G] dann [K]. Renders nothing for an empty spec. */
  let { keys }: { keys: string } = $props();

  const steps = $derived(KeySpec.labels(keys, keyboard.isMac));
</script>

{#if steps.length}
  <span class="keys" aria-label={KeySpec.text(keys, keyboard.isMac)}>
    {#each steps as step, i (i)}
      {#if i > 0}<span class="then" aria-hidden="true">dann</span>{/if}
      {#each step as part, j (j)}<kbd aria-hidden="true">{part}</kbd>{/each}
    {/each}
  </span>
{/if}

<style>
  .keys {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 3px;
    white-space: nowrap;
  }
  kbd {
    display: inline-grid;
    place-items: center;
    min-width: 20px;
    height: 20px;
    padding: 0 5px;
    border: 1px solid var(--color-border);
    border-bottom-width: 2px;
    border-radius: var(--radius-sm);
    background: var(--color-background);
    color: var(--color-text-muted);
    font-family: var(--font-family);
    font-size: 11px;
    font-weight: var(--font-weight-medium);
    line-height: 1;
  }
  .then {
    color: var(--color-text-faint);
    font-size: 11px;
  }
</style>
