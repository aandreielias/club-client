<script lang="ts" generics="T extends string">
  /** Single choice as a segmented control of radio buttons; the chosen pill glides to its place. */
  let {
    name,
    label,
    options,
    value = $bindable(),
    disabled = false,
  }: { name: string; label: string; options: readonly { value: T; label: string }[]; value: T | null; disabled?: boolean } = $props();

  let group: HTMLFieldSetElement | undefined = $state();
  let pill = $state<{ x: number; width: number } | null>(null);
  $effect(() => {
    void value;
    void options.length;
    const checked = group?.querySelector<HTMLElement>('label.checked');
    pill = checked ? { x: checked.offsetLeft, width: checked.offsetWidth } : null;
  });
</script>

<fieldset {disabled} class="segmented" bind:this={group}>
  <legend class="visually-hidden">{label}</legend>
  {#if pill}<span class="pill" aria-hidden="true" style:transform="translateX({pill.x}px)" style:width="{pill.width}px"></span>{/if}
  {#each options as option (option.value)}
    <label class:checked={value === option.value}>
      <input type="radio" {name} value={option.value} bind:group={value} />
      {option.label}
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
