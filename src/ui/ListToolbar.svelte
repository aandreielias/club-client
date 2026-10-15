<script lang="ts" generics="T">
  import type { Snippet } from 'svelte';
  import type { ListModel } from '../lib/list/ListModel.svelte';
  import Button from './Button.svelte';
  import Select from './Select.svelte';
  import Toolbar from './Toolbar.svelte';

  /**
   * Toolbar of a ListModel: `leading` (page-specific filters), search, filters and reset on the left;
   * sorting and `actions` on the right.
   */
  let { model, leading, actions }: { model: ListModel<T>; leading?: Snippet; actions?: Snippet } = $props();

  const sortOptions = $derived(model.columns.filter((c) => c.sortable !== false).map((c) => ({ value: c.key, label: c.label })));
</script>

<Toolbar>
  {#snippet start()}
    {@render leading?.()}
    {#if model.searchable}
      <input class="search" type="search" bind:value={model.search} placeholder="Suchen" aria-label="Suchen" />
    {/if}
    {#each model.filterDefinitions as filter (filter.key)}
      {#if filter.kind === 'select'}
        <Select
          inline
          aria-label={filter.label}
          value={model.filters[filter.key] ?? ''}
          onchange={(value) => model.setFilter(filter.key, value)}
          options={[{ value: '', label: filter.allLabel ?? filter.label }, ...(filter.options?.() ?? [])]}
        />
      {:else}
        <Button size="sm" pressed={!!model.filters[filter.key]} onclick={() => model.setFilter(filter.key, model.filters[filter.key] ? '' : '1')}
          tooltip="Filter „{filter.label}“ {model.filters[filter.key] ? 'ausschalten' : 'einschalten'}">
          {filter.label}
        </Button>
      {/if}
    {/each}
    {#if model.activeFilters > 0}
      <Button size="sm" variant="ghost" onclick={() => model.reset()}>Zurücksetzen</Button>
    {/if}
  {/snippet}
  {#snippet end()}
    {#if sortOptions.length}
      <span class="muted">Sortieren</span>
      <Select inline aria-label="Sortieren nach" value={model.sort.key} options={sortOptions}
        onchange={(key) => model.setSort({ key, dir: model.sort.dir })} />
      <Button size="sm" variant="ghost" onclick={() => model.setSort({ key: model.sort.key, dir: model.sort.dir === 'asc' ? 'desc' : 'asc' })}
        aria-label={model.sort.dir === 'asc' ? 'Aufsteigend, umkehren' : 'Absteigend, umkehren'}>
        {model.sort.dir === 'asc' ? 'Aufsteigend' : 'Absteigend'}
      </Button>
    {/if}
    {@render actions?.()}
  {/snippet}
</Toolbar>

<style>
  .search {
    width: 14rem;
  }
  :global([data-layout='compact']) .search {
    width: 100%;
  }
</style>
