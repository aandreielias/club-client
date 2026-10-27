<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import type { IconName } from '../icons';
  import type { CommandId } from '../shortcuts';
  import { BUTTON_TOOLTIPS } from '../tooltips';
  import Icon from './Icon.svelte';
  import { tooltip as showTooltip, withKeys } from './tooltip';

  type Variant = 'default' | 'primary' | 'ghost' | 'danger';
  type Size = 'md' | 'sm';

  let {
    variant = 'default',
    size = 'md',
    busy = false,
    pressed,
    tooltip,
    command,
    icon,
    children,
    ...rest
  }: HTMLButtonAttributes & {
    variant?: Variant;
    size?: Size;
    busy?: boolean;
    pressed?: boolean;
    /** Overrides the entry of src/tooltips.ts for this button's label; required for icon-only buttons. */
    tooltip?: string;
    /** Shows this command's keys in the tooltip. */
    command?: CommandId;
    /** Leading icon; without children the button is a square icon button labelled by `tooltip`. */
    icon?: IconName;
    children?: Snippet;
  } = $props();

  let element: HTMLButtonElement | undefined = $state();

  /** Explicit text, else the catalog entry of the visible label; read when the tooltip opens. */
  function text(): string | null {
    const label = element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const entry = BUTTON_TOOLTIPS[label];
    const value = tooltip ?? entry?.text ?? null;
    const keys = command ?? (tooltip ? undefined : entry?.command);
    return value && keys ? withKeys(value, keys) : value;
  }
</script>

<button
  bind:this={element}
  type="button"
  aria-label={children ? undefined : tooltip}
  {...rest}
  class="button {variant} {size}"
  class:pressed
  class:square={!children}
  class:busy
  disabled={busy || rest.disabled}
  aria-busy={busy}
  aria-pressed={pressed}
  {@attach showTooltip(text)}
>
  {#if icon}<Icon name={icon} small={size === 'sm'} />{/if}
  {#if children}<span class="content">{@render children()}</span>{/if}
</button>

<style>
  .button {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: var(--control-height);
    padding: 0 var(--control-padding-x);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-elevated);
    box-shadow: var(--color-shadow-raised);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
    line-height: 1.3;
    white-space: nowrap;
    cursor: pointer;
    transition:
      background var(--motion-fast),
      border-color var(--motion-fast),
      color var(--motion-fast),
      box-shadow var(--motion-fast),
      transform var(--motion-fast) var(--motion-easing);
  }
  .content {
    display: inline-flex;
    align-items: center;
    gap: var(--space-xs);
  }
  .sm {
    min-height: calc(var(--control-height) - 4px);
    padding: 0 var(--space-sm);
    font-size: var(--font-size-small);
  }
  .square {
    width: var(--control-height);
    padding: 0;
  }
  .sm.square {
    width: calc(var(--control-height) - 4px);
  }
  .button:hover:not(:disabled) {
    background: color-mix(in srgb, var(--color-elevated), var(--color-text) 4%);
    border-color: var(--color-border-strong);
  }
  .button:active:not(:disabled) {
    transform: scale(0.97);
  }
  .button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .button :global(.icon) {
    color: var(--color-text-muted);
    transition: color var(--motion-fast);
  }
  .button:hover:not(:disabled) :global(.icon) {
    color: currentColor;
  }
  .primary {
    border-color: transparent;
    background: var(--color-accent);
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 0.14),
      0 1px 2px color-mix(in srgb, var(--color-accent) 40%, transparent);
    color: var(--color-on-accent);
  }
  .primary :global(.icon),
  .primary:hover:not(:disabled) :global(.icon) {
    color: var(--color-on-accent);
  }
  .primary:hover:not(:disabled) {
    border-color: transparent;
    background: color-mix(in srgb, var(--color-accent), black 8%);
  }
  .ghost {
    border-color: transparent;
    background: transparent;
    box-shadow: none;
    color: var(--color-text-muted);
  }
  .ghost:hover:not(:disabled) {
    border-color: transparent;
    background: var(--color-hover);
    color: var(--color-text);
  }
  .danger {
    color: var(--color-danger);
  }
  .danger :global(.icon) {
    color: var(--color-danger);
  }
  .danger:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--color-danger) 35%, transparent);
    background: var(--color-tag-red-bg);
  }
  .pressed,
  .pressed:hover:not(:disabled) {
    border-color: var(--color-border-strong);
    background: var(--color-selected);
    color: var(--color-text);
  }
  /* Busy: the label fades and a small ring spins in its place. */
  .busy .content,
  .busy :global(.icon) {
    opacity: 0;
  }
  .busy::after {
    content: '';
    position: absolute;
    inset: 0;
    width: 14px;
    height: 14px;
    margin: auto;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  .busy:disabled {
    opacity: 0.85;
  }
  @keyframes spin {
    to {
      transform: rotate(1turn);
    }
  }
</style>
