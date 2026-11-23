<script lang="ts">
  /** A range slider in the house style: the filled part of the track shows the value, its readable form stands beside it. */
  let {
    value = $bindable(),
    min,
    max,
    step = 1,
    text,
    oninput,
  }: {
    value: number;
    min: number;
    max: number;
    step?: number;
    /** The value as people read it (also given to screen readers). */
    text: string;
    oninput?: (value: number) => void;
  } = $props();

  const fill = $derived(`${((value - min) / (max - min)) * 100}%`);
</script>

<span class="slider">
  <input
    type="range"
    {min}
    {max}
    {step}
    bind:value
    aria-valuetext={text}
    style:--fill={fill}
    oninput={(e) => oninput?.(Number(e.currentTarget.value))}
  />
  <output aria-hidden="true">{text}</output>
</span>

<style>
  .slider {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    max-width: var(--layout-readable-width);
  }
  input {
    flex: 1;
    min-width: 0;
    height: var(--control-height);
    margin: 0;
    padding: 0;
    border: none;
    background: none;
    box-shadow: none;
    appearance: none;
    cursor: pointer;
  }
  input:focus-visible {
    outline: none;
  }
  input::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: 2px;
    background: linear-gradient(to right, var(--color-accent) var(--fill), var(--color-border) var(--fill));
  }
  input::-moz-range-track {
    height: 4px;
    border-radius: 2px;
    background: var(--color-border);
  }
  input::-moz-range-progress {
    height: 4px;
    border-radius: 2px;
    background: var(--color-accent);
  }
  input::-webkit-slider-thumb {
    appearance: none;
    width: 16px;
    height: 16px;
    margin-top: -6px;
    border: 2px solid var(--color-accent);
    border-radius: 50%;
    background: var(--color-surface);
    box-shadow: var(--color-shadow-raised);
    transition: box-shadow var(--motion-fast);
  }
  input::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border: 2px solid var(--color-accent);
    border-radius: 50%;
    background: var(--color-surface);
    box-shadow: var(--color-shadow-raised);
    transition: box-shadow var(--motion-fast);
  }
  input:focus-visible::-webkit-slider-thumb {
    box-shadow: 0 0 0 4px var(--color-accent-soft);
  }
  input:focus-visible::-moz-range-thumb {
    box-shadow: 0 0 0 4px var(--color-accent-soft);
  }
  output {
    min-width: 7em;
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
  }
</style>
