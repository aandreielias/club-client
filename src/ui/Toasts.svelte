<script lang="ts">
  import { flip } from 'svelte/animate';
  import { motion, toasts } from '../lib/container';
  import Icon from './Icon.svelte';
  import { tooltip } from './tooltip';
</script>

<div class="toasts" aria-live="polite">
  {#each toasts.items as toast (toast.id)}
    <div class="toast" class:error={toast.error} role={toast.error ? 'alert' : 'status'}
      in:motion.rise={{ distance: 16 }} out:motion.pop={{ origin: 'bottom' }} animate:flip={{ duration: motion.ms('base') }}>
      <Icon name={toast.error ? 'alert' : 'check'} small />
      <span>{toast.text}</span>
      {#if toast.action}
        {@const action = toast.action}
        <button class="action" onclick={() => (toasts.dismiss(toast.id), action.run())} {@attach tooltip(action.label)}>{action.label}</button>
      {/if}
      <button class="dismiss" aria-label="Schließen" onclick={() => toasts.dismiss(toast.id)} {@attach tooltip('Meldung schließen')}><Icon name="close" small /></button>
    </div>
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    bottom: var(--space-lg);
    left: 50%;
    z-index: 50;
    display: grid;
    justify-items: center;
    gap: var(--space-sm);
    width: max-content;
    max-width: calc(100vw - 2 * var(--space-lg));
    translate: -50% 0;
  }
  .toast {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    min-height: 38px;
    padding: 0 var(--space-xs) 0 var(--space-md);
    border-radius: var(--radius-lg);
    background: var(--color-elevated);
    box-shadow: var(--color-shadow-popover);
    font-weight: var(--font-weight-medium);
  }
  .toast > :global(.icon) {
    color: var(--color-success);
  }
  .error > :global(.icon) {
    color: var(--color-danger);
  }
  .action {
    padding: 2px var(--space-sm);
    border: 0;
    border-radius: var(--radius-md);
    background: var(--color-accent-soft);
    color: var(--color-accent);
    font: inherit;
    font-weight: var(--font-weight-bold);
    cursor: pointer;
    transition: background var(--motion-fast);
  }
  .action:hover {
    background: color-mix(in srgb, var(--color-accent) 25%, transparent);
  }
  .dismiss {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border: 0;
    border-radius: var(--radius-md);
    background: none;
    color: var(--color-text-faint);
    cursor: pointer;
    transition:
      background var(--motion-fast),
      color var(--motion-fast);
  }
  .dismiss:hover {
    background: var(--color-hover);
    color: var(--color-text);
  }
</style>
