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
    <span class="skeleton"></span><span class="skeleton"></span><span class="skeleton"></span>
  </div>
{:else}
  <div class="loaded">{@render children(resource.value)}</div>
{/if}

<style>
  .loading {
    display: grid;
    gap: var(--space-sm);
    padding: var(--space-sm) 0;
  }
  .loading span {
    height: 14px;
  }
  /* Arrived content fades in; `display: contents` keeps the caller's layout. */
  .loaded {
    display: contents;
  }
  .loaded > :global(*) {
    animation: rise var(--motion-slow) var(--motion-easing) both;
  }
  .loading span:nth-child(2) {
    width: 80%;
  }
  .loading span:nth-child(3) {
    width: 60%;
  }
</style>
