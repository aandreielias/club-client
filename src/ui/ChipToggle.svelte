<script lang="ts" generics="T extends string">
  import { tooltip } from './tooltip';

  /**
   * Several choices as toggle pills in one wrapping row: a pill is on or off (`aria-pressed`); arrow keys move between pills.
   * `disabled` pills keep their state (e.g. a choice that is always on).
   */
  let {
    label,
    options,
    value = $bindable(),
  }: {
    label: string;
    options: readonly { value: T; label: string; disabled?: boolean }[];
    value: T[];
  } = $props();

  function toggle(option: T) {
    value = value.includes(option) ? value.filter((v) => v !== option) : [...value, option];
  }

  function keydown(event: KeyboardEvent) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const buttons = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('button')];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    event.preventDefault();
    buttons[(index + (event.key === 'ArrowRight' ? 1 : buttons.length - 1)) % buttons.length]?.focus();
  }
</script>

<div class="chips" role="toolbar" aria-label={label} tabindex="-1" onkeydown={keydown}>
  {#each options as option (option.value)}
    {@const on = value.includes(option.value)}
    <button type="button" class="chip" class:on aria-pressed={on} disabled={option.disabled} onclick={() => toggle(option.value)}
      {@attach tooltip(`${option.label} ${on ? 'abwählen' : 'wählen'}`)}>
      {option.label}
    </button>
  {/each}
</div>

<style>
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs);
  }
  .chip {
    min-height: 28px;
    padding: 0 var(--space-md);
    border: 1px solid var(--color-border);
    border-radius: 999px;
    background: var(--color-field);
    color: var(--color-text-muted);
    font: inherit;
    font-size: var(--font-size-small);
    cursor: pointer;
    transition:
      background var(--motion-fast) var(--motion-easing),
      border-color var(--motion-fast) var(--motion-easing),
      color var(--motion-fast) var(--motion-easing);
  }
  .chip:hover:not(:disabled) {
    border-color: var(--color-border-strong);
  }
  .chip.on {
    border-color: var(--color-accent);
    background: var(--color-accent-soft);
    color: var(--color-accent);
    font-weight: var(--font-weight-medium);
  }
  .chip:disabled {
    cursor: default;
    opacity: 0.7;
  }
</style>
