<script lang="ts" generics="T extends string">
  /** Several choices as a group of checkboxes (roles, teams); locked options stay visible. */
  let {
    value = $bindable(),
    options,
    legend,
    error,
  }: {
    value: T[];
    options: readonly { value: T; label: string; disabled?: boolean }[];
    legend: string;
    error?: string | null;
  } = $props();

  function toggle(option: T, on: boolean) {
    value = on ? [...value, option] : value.filter((v) => v !== option);
  }
</script>

<fieldset>
  <legend>{legend}</legend>
  <div class="options">
    {#each options as option (option.value)}
      <label class="check">
        <input
          type="checkbox"
          checked={value.includes(option.value)}
          disabled={option.disabled}
          onchange={(e) => toggle(option.value, e.currentTarget.checked)}
        />
        {option.label}
      </label>
    {/each}
  </div>
  {#if error}<span class="error" role="alert">{error}</span>{/if}
</fieldset>

<style>
  fieldset {
    display: grid;
    gap: var(--space-xs);
    margin: 0;
    padding: 0;
    border: 0;
  }
  legend {
    margin-bottom: var(--space-xs);
    color: var(--color-text-muted);
    font-size: var(--font-size-small);
    font-weight: var(--font-weight-medium);
  }
  .options {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
    gap: var(--space-xs) var(--space-md);
  }
  .error {
    color: var(--color-danger);
    font-size: var(--font-size-small);
  }
</style>
