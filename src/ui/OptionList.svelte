<script lang="ts" generics="T extends string">
  import InfoTip from './InfoTip.svelte';
  import { toggled } from './options';

  /**
   * A multiple choice as a list of checkboxes, each with its name and an ⓘ with a short explanation, in two columns on wide screens. Disabled
   * options keep their state (e.g. a choice that is always on). Replaces rows of toggle pills where the choices need explaining.
   */
  let {
    label,
    options,
    value = $bindable(),
  }: {
    label: string;
    options: readonly { value: T; label: string; hint?: string; disabled?: boolean }[];
    value: T[];
  } = $props();
</script>

<fieldset class="options">
  <legend class="visually-hidden">{label}</legend>
  {#each options as option (option.value)}
    <div class="option" class:on={value.includes(option.value)} class:disabled={option.disabled}>
      <label>
        <input
          type="checkbox"
          checked={value.includes(option.value)}
          disabled={option.disabled}
          onchange={() =>
            (value = toggled(
              value,
              option.value,
              options.map((o) => o.value),
            ))}
        />
        <span class="name">{option.label}</span>
      </label>
      {#if option.hint}<InfoTip text={option.hint} />{/if}
    </div>
  {/each}
</fieldset>

<style>
  .options {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
    gap: var(--space-xs);
  }
  .option {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-sm);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition:
      border-color var(--motion-fast),
      background var(--motion-fast);
  }
  .option:hover {
    background: var(--color-hover);
  }
  .option.on {
    border-color: var(--color-accent);
    background: var(--color-accent-soft);
  }
  .option.disabled {
    cursor: default;
    opacity: 0.75;
  }
  label {
    display: flex;
    flex: 1;
    align-items: center;
    gap: var(--space-sm);
    cursor: inherit;
  }
  .name {
    font-weight: var(--font-weight-medium);
  }
</style>
