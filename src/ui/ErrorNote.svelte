<script lang="ts">
  import { errors } from '../lib/container';
  import Icon from './Icon.svelte';

  /** Shows the user-facing text of an error; renders nothing while `error` is empty. */
  let { error }: { error: unknown } = $props();
</script>

{#if error}
  <p class="error" role="alert"><Icon name="alert" small />{errors.text(error)}</p>
{/if}

<style>
  .error {
    display: flex;
    align-items: flex-start;
    gap: var(--space-sm);
    margin: 0;
    padding: var(--space-sm) var(--space-md);
    border-radius: var(--radius-md);
    background: var(--color-tag-red-bg);
    color: var(--color-tag-red-text);
    animation: rise var(--motion-base) var(--motion-easing);
  }
  .error :global(.icon) {
    margin-top: 3px;
  }
</style>
