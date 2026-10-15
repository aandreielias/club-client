<script lang="ts">
  import { toasts } from '../lib/container';
</script>

<div class="toasts" aria-live="polite">
  {#each toasts.items as toast (toast.id)}
    <div class="toast" class:error={toast.error} role={toast.error ? 'alert' : 'status'}>{toast.text}</div>
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
    padding: var(--space-sm) var(--space-md);
    border-radius: var(--radius-md);
    background: var(--color-text);
    color: var(--color-background);
    box-shadow: var(--color-shadow-popover);
  }
  .error {
    background: var(--color-danger);
    color: var(--color-on-accent);
  }
</style>
