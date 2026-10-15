<script lang="ts">
  import type { Snippet } from 'svelte';

  /** Narrow centred column for login, onboarding and status screens. */
  let { title, subtitle, children }: { title: string; subtitle?: string; children?: Snippet } = $props();
</script>

<main>
  <section>
    {#if subtitle}<p class="muted subtitle">{subtitle}</p>{/if}
    <h1>{title}</h1>
    {@render children?.()}
  </section>
</main>

<style>
  main {
    display: grid;
    place-items: center;
    min-height: 100dvh;
    padding: var(--space-lg);
  }
  section {
    width: min(var(--layout-narrow-width), 100%);
  }
  .subtitle {
    margin: 0 0 var(--space-xs);
    font-size: var(--font-size-small);
  }
  h1 {
    margin-bottom: var(--space-xl);
  }
</style>
