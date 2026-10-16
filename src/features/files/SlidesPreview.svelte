<script lang="ts">
  import type { Slide } from './OfficeReader';

  /** The text of every slide (titles and bullet lines), in slide order. */
  let { slides }: { slides: readonly Slide[] } = $props();
</script>

{#if slides.length}
  <ol class="slides">
    {#each slides as slide, index (index)}
      <li class="slide">
        <span class="number muted">{index + 1}</span>
        {#if slide.title}<h3>{slide.title}</h3>{/if}
        {#if slide.lines.length}
          <ul>
            {#each slide.lines as line, i (i)}<li>{line}</li>{/each}
          </ul>
        {:else if !slide.title}
          <p class="muted">Folie ohne Text.</p>
        {/if}
      </li>
    {/each}
  </ol>
{:else}
  <p class="muted empty">Die Präsentation hat keine Folien.</p>
{/if}

<style>
  .slides {
    display: grid;
    gap: var(--space-lg);
    max-height: min(70vh, 800px);
    margin: 0;
    padding: var(--space-lg);
    overflow-y: auto;
    list-style: none;
  }
  .slide {
    position: relative;
    aspect-ratio: 16 / 9;
    padding: 6% 8%;
    overflow: hidden;
    border-radius: var(--radius-md);
    background: var(--color-elevated);
    box-shadow: var(--color-shadow-raised);
  }
  .number {
    position: absolute;
    right: var(--space-md);
    bottom: var(--space-sm);
    font-size: var(--font-size-small);
  }
  h3 {
    margin-bottom: var(--space-md);
    font-size: var(--font-size-h1);
  }
  ul {
    display: grid;
    gap: var(--space-xs);
    padding-left: 1.2em;
    list-style: disc;
  }
  .empty {
    margin: 0;
    padding: var(--space-lg);
  }
</style>
