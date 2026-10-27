<script lang="ts">
  import Button from '../../ui/Button.svelte';
  import Select from '../../ui/Select.svelte';
  import type { Person } from './model';

  /**
   * Choosing a few people as removable chips (who carries out a resolution or a task). `candidates`: who may be chosen (those present
   * who can do it); `known` names people chosen earlier who are no candidates any more.
   */
  let {
    value = $bindable(),
    candidates,
    known = [],
    label,
    placeholder = 'Person hinzufügen',
    disabled = false,
    onchange,
  }: {
    value: string[];
    candidates: readonly Person[];
    known?: readonly Person[];
    label: string;
    placeholder?: string;
    disabled?: boolean;
    onchange?: (ids: string[]) => void;
  } = $props();

  const options = $derived(candidates.filter((p) => !value.includes(p.memberId)).map((p) => ({ value: p.memberId, label: p.name })));
  const nameOf = (id: string) => [...candidates, ...known].find((p) => p.memberId === id)?.name ?? 'Mitglied';

  let pick = $state('');

  function add(id: string) {
    if (id) set([...value, id]);
    pick = '';
  }

  function set(ids: string[]) {
    value = ids;
    onchange?.(ids);
  }
</script>

<div class="chips-field" role="group" aria-label={label}>
  {#each value as id (id)}
    <span class="chip"
      >{nameOf(id)}{#if !disabled}<Button
          size="sm"
          variant="ghost"
          icon="close"
          tooltip="Entfernen"
          onclick={() => set(value.filter((v) => v !== id))}
        />{/if}</span
    >
  {/each}
  {#if !disabled}
    {#if candidates.length}
      <Select bind:value={pick} {placeholder} {options} aria-label={label} onchange={add} />
    {:else}
      <span class="muted small">Niemand anwesend, der das übernehmen kann; ohne Auswahl übernimmt der Vorstand.</span>
    {/if}
  {/if}
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
</style>
