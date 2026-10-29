<script lang="ts" generics="T extends string">
  import { toggled } from './options';

  /**
   * A multiple choice as a list of checkboxes, each with its name and a short explanation, in two columns on wide screens. Disabled
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
    <label class="option" class:on={value.includes(option.value)} class:disabled={option.disabled}>
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
      <span class="text">
        <span class="name">{option.label}</span>
        {#if option.hint}<span class="hint">{option.hint}</span>{/if}
      </span>
    </label>
  {/each}
</fieldset>

<style>
  .options {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
    gap: var(--space-xs);
    margin: 0;
    padding: 0;
    border: 0;
  }
  .option {
    display: flex;
    align-items: flex-start;
    gap: var(--space-sm);
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
  .option input {
    margin-top: 2px;
  }
  .text {
    display: grid;
    gap: 2px;
  }
  .name {
    font-weight: var(--font-weight-medium);
  }
  .hint {
    color: var(--color-text-muted);
    font-size: var(--font-size-small);
  }
</style>
