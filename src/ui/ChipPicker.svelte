<script lang="ts" module>
  export interface ChipOption {
    value: string;
    label: string;
    /** Shown after the label in the suggestions only (e.g. the teams of a person, the kind of an entry). */
    detail?: string;
  }
</script>

<script lang="ts">
  import { settings } from '../settings';
  import Button from './Button.svelte';
  import SearchSelect from './SearchSelect.svelte';

  /**
   * Choosing entries out of many as removable chips: typing suggests the options not chosen yet (label and detail match).
   * Chosen values without an option (e.g. no longer offered) keep their chip under `labelOf`.
   */
  let {
    value,
    options,
    onchange,
    label,
    placeholder = 'Suchen und hinzufügen',
    emptyText = 'Keine Treffer.',
    labelOf = (v: string) => v,
  }: {
    value: readonly string[];
    options: readonly ChipOption[];
    onchange: (next: string[]) => void;
    label: string;
    placeholder?: string;
    emptyText?: string;
    labelOf?: (value: string) => string;
  } = $props();

  const chipLabel = (v: string) => options.find((o) => o.value === v)?.label ?? labelOf(v);

  function search(query: string) {
    const words = query.toLocaleLowerCase('de').split(/\s+/).filter(Boolean);
    return options
      .filter((o) => !value.includes(o.value))
      .filter((o) => {
        const text = `${o.label} ${o.detail ?? ''}`.toLocaleLowerCase('de');
        return words.every((w) => text.includes(w));
      })
      .slice(0, settings.chipPicker.maxSuggestions)
      .map((o) => ({ value: o.value, label: o.detail ? `${o.label} · ${o.detail}` : o.label }));
  }
</script>

<div class="chips-field" role="group" aria-label={label}>
  {#each value as v (v)}
    <span class="chip"
      >{chipLabel(v)}<Button
        size="sm"
        variant="ghost"
        icon="close"
        tooltip="Entfernen"
        onclick={() => onchange(value.filter((x) => x !== v))}
      /></span
    >
  {/each}
  <span class="search"><SearchSelect {search} {placeholder} {emptyText} aria-label={label} onpick={(v) => onchange([...value, v])} /></span>
</div>

<style>
  .chips-field {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-xs);
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-xxs);
    padding: 0 var(--space-xxs) 0 var(--space-sm);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    background: var(--color-surface);
    font-size: var(--font-size-small);
  }
  .search {
    flex: 1 1 12rem;
    min-width: 12rem;
  }
</style>
