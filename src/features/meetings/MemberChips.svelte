<script lang="ts">
  import { directory } from '../../lib/container';
  import { Resource } from '../../lib/state/Resource.svelte';
  import Button from '../../ui/Button.svelte';
  import Select from '../../ui/Select.svelte';

  /** Choosing a few people as removable chips (who carries out a resolution or a task); for admin and board. */
  let {
    value = $bindable(),
    label,
    placeholder = 'Person hinzufügen',
    disabled = false,
    onchange,
  }: { value: string[]; label: string; placeholder?: string; disabled?: boolean; onchange?: (ids: string[]) => void } = $props();

  const members = new Resource(() => directory.allMembers());
  void members.load();
  const options = $derived((members.value ?? []).filter((m) => m.active && !value.includes(m.id))
    .map((m) => ({ value: m.id, label: `${m.lastName}, ${m.firstName}` })));

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
    <span class="chip">{directory.nameOf(id)}{#if !disabled}<Button size="sm" variant="ghost" icon="close" tooltip="Entfernen" onclick={() => set(value.filter((v) => v !== id))} />{/if}</span>
  {/each}
  {#if !disabled}
    <Select bind:value={pick} {placeholder} {options} aria-label={label} onchange={add} />
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
