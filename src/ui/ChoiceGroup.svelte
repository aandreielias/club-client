<script lang="ts" generics="T extends string">
  /** Single choice as a segmented control of radio buttons. */
  let {
    name,
    label,
    options,
    value = $bindable(),
    disabled = false,
  }: { name: string; label: string; options: readonly { value: T; label: string }[]; value: T | null; disabled?: boolean } = $props();
</script>

<fieldset {disabled} class="segmented">
  <legend class="visually-hidden">{label}</legend>
  {#each options as option (option.value)}
    <label class:checked={value === option.value}>
      <input type="radio" {name} value={option.value} bind:group={value} />
      {option.label}
    </label>
  {/each}
</fieldset>

<style>
  .segmented {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 2px;
    margin: 0;
    padding: 2px;
    border: 0;
    border-radius: var(--radius-md);
    background: var(--color-hover);
  }
  label {
    display: inline-flex;
    align-items: center;
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
  label.checked {
    background: var(--color-background);
    color: var(--color-text);
    box-shadow: var(--color-shadow-popover);
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
