<script lang="ts" generics="T">
  import type { Snippet } from 'svelte';
  import type { Resource } from '../lib/state/Resource.svelte';
  import Button from './Button.svelte';
  import ErrorNote from './ErrorNote.svelte';

  /** Renders a Resource: placeholder lines while loading, error with retry, or `children(value)`. */
  let { resource, children }: { resource: Resource<T>; children: Snippet<[T]> } = $props();
</script>

{#if resource.error}
  <div class="stack">
    <ErrorNote error={resource.error} />
    <div><Button onclick={() => resource.load()}>Erneut versuchen</Button></div>
  </div>
{:else if resource.value === undefined}
  <div class="loading" aria-busy="true" aria-label="Laden">
    <span></span><span></span><span></span>
  </div>
{:else}
  {@render children(resource.value)}
{/if}

<style>
  .loading {
    display: grid;
    gap: var(--space-sm);
    padding: var(--space-sm) 0;
  }
  .loading span {
    height: 14px;
    border-radius: var(--radius-sm);
    background: var(--color-hover);
  }
  .loading span:nth-child(2) {
    width: 80%;
  }
  .loading span:nth-child(3) {
    width: 60%;
  }
</style>
