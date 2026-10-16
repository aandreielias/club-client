<script lang="ts" module>
  import type { IconName } from '../icons';

  /** The next step offered on an empty list (e.g. "Neue Aufgabe", "Filter zurücksetzen"). */
  export interface EmptyAction {
    label: string;
    icon?: IconName;
    run: () => void;
  }
</script>

<script lang="ts">
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';

  let { text, action }: { text: string; action?: EmptyAction | null } = $props();
</script>

<div class="empty enter">
  <span class="glyph"><Icon name="empty" /></span>
  <p>{text}</p>
  {#if action}<Button icon={action.icon} onclick={action.run} tooltip={action.label}>{action.label}</Button>{/if}
</div>

<style>
  .empty {
    display: grid;
    justify-items: center;
    gap: var(--space-sm);
    padding: var(--space-xxl) var(--space-lg);
    color: var(--color-text-muted);
    text-align: center;
  }
  .glyph {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: var(--radius-lg);
    background: var(--color-hover);
    color: var(--color-text-faint);
  }
  p {
    margin: 0;
  }
</style>
