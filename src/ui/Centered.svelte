<script lang="ts">
  import type { Snippet } from 'svelte';

  /** Narrow centred column for login, onboarding and status screens. */
  let { title, subtitle, children }: { title: string; subtitle?: string; children?: Snippet } = $props();
</script>

<main>
  <section class="enter">
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
  main {
    background: radial-gradient(1200px 600px at 50% -10%, var(--color-accent-soft), transparent 70%), var(--color-background);
  }
  section {
    width: min(var(--layout-narrow-width), 100%);
    padding: var(--space-xl);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    background: var(--color-elevated);
    box-shadow: var(--color-shadow-popover);
  }
  .subtitle {
    margin: 0 0 var(--space-xs);
    font-size: var(--font-size-small);
  }
  h1 {
    margin-bottom: var(--space-lg);
    font-size: var(--font-size-h1);
  }
</style>
