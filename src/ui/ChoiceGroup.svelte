<script lang="ts" module>
  import type { IconName } from '../icons';

  export interface Choice<T extends string> {
    value: T;
    label: string;
    icon?: IconName;
    /** Tooltip; defaults to the label for icon-only choices. */
    hint?: string;
  }
</script>

<script lang="ts" generics="T extends string">
  import Icon from './Icon.svelte';
  import { tooltip } from './tooltip';

  /** Single choice as a segmented control of radio buttons; the chosen pill glides to its place. */
  let {
    name,
    label,
    options,
    value = $bindable(),
    disabled = false,
    iconOnly = false,
    size = 'md',
  }: {
    name: string;
    label: string;
    options: readonly Choice<T>[];
    value: T | null;
    disabled?: boolean;
    /** Shows only the icons; labels become tooltips and accessible names. */
    iconOnly?: boolean;
    size?: 'md' | 'sm';
  } = $props();

  let group: HTMLFieldSetElement | undefined = $state();
  let pill = $state<{ x: number; width: number } | null>(null);

  function measure() {
    const checked = group?.querySelector<HTMLElement>('label.checked');
    pill = checked ? { x: checked.offsetLeft, width: checked.offsetWidth } : null;
  }

  $effect(() => {
    void value;
    void options.length;
    measure();
  });

  // Late layout changes (web font, container width) move the labels; keep the pill on them.
  $effect(() => {
    if (!group) return;
    const observer = new ResizeObserver(measure);
    observer.observe(group);
    return () => observer.disconnect();
  });
</script>

<fieldset {disabled} class="segmented {size}" class:icon-only={iconOnly} bind:this={group}>
  <legend class="visually-hidden">{label}</legend>
  {#if pill}<span class="pill" aria-hidden="true" style:transform="translateX({pill.x}px)" style:width="{pill.width}px"></span>{/if}
  {#each options as option (option.value)}
    <label class:checked={value === option.value} {@attach tooltip(option.hint ?? (iconOnly ? option.label : null))}>
      <input type="radio" {name} value={option.value} bind:group={value} aria-label={iconOnly ? option.label : undefined} />
      {#if option.icon}<Icon name={option.icon} small={size === 'sm'} />{/if}
      {#if !iconOnly}{option.label}{/if}
    </label>
  {/each}
</fieldset>

<style>
  .segmented {
    position: relative;
    display: inline-flex;
    flex-wrap: wrap;
    gap: 2px;
    margin: 0;
    padding: 2px;
    border: 0;
    border-radius: var(--radius-md);
    background: var(--color-hover);
  }
  .pill {
    position: absolute;
    top: 2px;
    bottom: 2px;
    left: 0;
    border-radius: calc(var(--radius-md) - 2px);
    background: var(--color-elevated);
    box-shadow: var(--color-shadow-raised);
    transition:
      transform var(--motion-base) var(--motion-easing),
      width var(--motion-base) var(--motion-easing);
  }
  label {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: calc(var(--control-height) - 4px);
    padding: 0 var(--control-padding-x);
    border-radius: calc(var(--radius-md) - 2px);
    color: var(--color-text-muted);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition:
      background var(--motion-fast),
      color var(--motion-fast);
  }
  label:hover {
    color: var(--color-text);
  }
  label :global(.icon) {
    margin-left: -2px;
  }
  .icon-only label {
    justify-content: center;
    padding: 0;
    width: calc(var(--control-height) - 4px);
  }
  .icon-only label :global(.icon) {
    margin: 0;
  }
  .sm label {
    min-height: calc(var(--control-height) - 8px);
    font-size: var(--font-size-small);
  }
  .sm.icon-only label {
    width: calc(var(--control-height) - 6px);
  }
  label.checked {
    color: var(--color-text);
  }
  label:has(input:focus-visible) {
    outline: 2px solid var(--color-accent);
    outline-offset: 1px;
  }
  input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .segmented:disabled label {
    opacity: 0.5;
    cursor: default;
  }
</style>
