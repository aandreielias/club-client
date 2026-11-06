<script lang="ts" generics="T">
  import type { Hue } from '../lib/types';
  import { tooltip } from './tooltip';

  /** A colour as a row of swatches (radio buttons); the name shows as tooltip and is read out. Hue null = "no colour". */
  let {
    label,
    options,
    value = $bindable(),
  }: { label: string; options: readonly { value: T; label: string; hue: Hue | null }[]; value: T } = $props();
</script>

<div class="swatches" role="radiogroup" aria-label={label}>
  {#each options as option (option.value)}
    <label
      class="swatch"
      class:none={option.hue === null}
      {@attach tooltip(option.label)}
      style:--swatch={option.hue && `var(--color-tag-${option.hue}-text)`}
    >
      <input type="radio" name={label} value={option.value} bind:group={value} aria-label={option.label} />
      <span class="dot" aria-hidden="true"></span>
    </label>
  {/each}
</div>

<style>
  .swatches {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs);
  }
  .swatch {
    position: relative;
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border-radius: var(--radius-full);
    cursor: pointer;
  }
  .swatch input {
    position: absolute;
    inset: 0;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }
  .dot {
    width: 1.25rem;
    height: 1.25rem;
    border-radius: var(--radius-full);
    background: var(--swatch);
    box-shadow: 0 0 0 2px var(--color-surface);
    transition: box-shadow var(--motion-fast);
  }
  .none .dot {
    --swatch: var(--color-text-faint);
    background: linear-gradient(135deg, transparent 45%, var(--swatch) 45% 55%, transparent 55%), var(--color-field);
  }
  .swatch:has(input:checked) .dot {
    box-shadow:
      0 0 0 2px var(--color-surface),
      0 0 0 4px var(--swatch);
  }
  .swatch:has(input:focus-visible) .dot {
    outline: 2px solid var(--color-accent);
    outline-offset: 4px;
  }
</style>
