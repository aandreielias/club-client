<script lang="ts" generics="T">
  import type { Snippet } from 'svelte';
  import type { ListModel } from '../lib/list/ListModel.svelte';
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';
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
      <label class="search">
        <Icon name="search" small />
        <input
          type="search"
          bind:value={model.search}
          placeholder="Suchen"
          aria-label="Suchen"
          onkeydown={(e) => e.key === 'Enter' && e.preventDefault()}
        />
      </label>
    {/if}
    {#each model.filterDefinitions as filter (filter.key)}
      {#if filter.kind === 'select'}
        <Select
          inline
          aria-label={filter.label}
          value={model.filters[filter.key] ?? ''}
          onchange={(value) => model.setFilter(filter.key, value)}
          options={[{ value: '', label: filter.allLabel ?? filter.label }, ...(filter.options?.(model.data.value ?? []) ?? [])]}
        />
      {:else if filter.kind === 'multi'}
        {@const chosen = (model.filters[filter.key] ?? '').split(',').filter(Boolean)}
        {@const options = filter.options?.(model.data.value ?? []) ?? []}
        {#each chosen as value (value)}
          <Button
            size="sm"
            pressed
            icon="close"
            onclick={() => model.setFilter(filter.key, chosen.filter((v) => v !== value).join(','))}
            tooltip="Filter entfernen">{options.find((o) => o.value === value)?.label ?? value}</Button
          >
        {/each}
        {#if options.some((o) => !chosen.includes(o.value))}
          <Select
            inline
            aria-label={filter.label}
            value=""
            onchange={(value) => value && model.setFilter(filter.key, [...chosen, value].join(','))}
            options={[{ value: '', label: filter.allLabel ?? filter.label }, ...options.filter((o) => !chosen.includes(o.value))]}
          />
        {/if}
      {:else}
        <Button
          size="sm"
          pressed={!!model.filters[filter.key]}
          onclick={() => model.setFilter(filter.key, model.filters[filter.key] ? '' : '1')}
          tooltip="Filter „{filter.label}“ {model.filters[filter.key] ? 'ausschalten' : 'einschalten'}"
        >
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
      <Select
        inline
        aria-label="Sortieren nach"
        value={model.sort.key}
        options={sortOptions}
        onchange={(key) => model.setSort({ key, dir: model.sort.dir })}
      />
      <Button
        size="sm"
        variant="ghost"
        icon="sort"
        onclick={() => model.setSort({ key: model.sort.key, dir: model.sort.dir === 'asc' ? 'desc' : 'asc' })}
        tooltip={model.sort.dir === 'asc' ? 'Aufsteigend, umkehren' : 'Absteigend, umkehren'}
      />
    {/if}
    {@render actions?.()}
  {/snippet}
</Toolbar>

<style>
  .search {
    position: relative;
    display: block;
    width: 14rem;
  }
  .search :global(.icon) {
    position: absolute;
    top: 50%;
    left: var(--space-sm);
    translate: 0 -50%;
    color: var(--color-text-faint);
    pointer-events: none;
  }
  .search input {
    padding-left: 28px;
  }
  :global([data-layout='compact']) .search {
    width: 100%;
  }
</style>
