<script lang="ts" generics="T">
  import { tick, type Snippet } from 'svelte';
  import { flip } from 'svelte/animate';
  import { commands, motion } from '../lib/container';
  import Icon from './Icon.svelte';
  import { useCommands } from '../lib/keyboard/useCommands.svelte';
  import { ListCursors, type ListColumn, type ListModel } from '../lib/list/ListModel.svelte';
  import type { MenuEntry } from '../lib/overlay/ContextMenuService.svelte';
  import AsyncView from './AsyncView.svelte';
  import Empty, { type EmptyAction } from './Empty.svelte';
  import ListToolbar from './ListToolbar.svelte';
  import { tooltip } from './tooltip';
  import { menu as contextMenu, openMenuAt } from './contextMenu';

  /**
   * The one list of the app (Notion database style): toolbar, sortable header, clickable rows.
   * `cell` renders custom cells (return nothing to fall back to the column's text); the first
   * column holds the row's button, so keyboard and screen-reader users can open rows too.
   */
  let {
    model,
    rowKey,
    onopen,
    cell,
    actions,
    leading,
    emptyText = 'Keine Einträge.',
    selected = null,
    toolbar = true,
    menu,
    check,
    limit,
    emptyAction,
  }: {
    model: ListModel<T>;
    rowKey: (item: T) => string;
    onopen?: (item: T) => void;
    cell?: Snippet<[T, ListColumn<T>]>;
    actions?: Snippet;
    /** Page-specific filters shown first in the toolbar (e.g. the calendar's source toggles). */
    leading?: Snippet;
    emptyText?: string;
    selected?: string | null;
    toolbar?: boolean;
    /** Right-click menu of a row (also Shift+F10 / context-menu key on the keyboard row). */
    menu?: (item: T) => readonly MenuEntry[];
    /** Offered when the list itself is empty (filtered-out lists offer "Filter zurücksetzen"). */
    emptyAction?: EmptyAction | null;
    /** Shows only the first rows (start page sections); the toolbar and counts still see all. */
    limit?: number;
    /** Checkbox column (choosing people etc.): checked state, toggle and optional lock per row. */
    check?: { checked: (item: T) => boolean; toggle: (item: T) => void; disabled?: (item: T) => boolean; label: (item: T) => string };
  } = $props();

  /** Keyboard cursor (J/K/Enter); -1 = none. Kept per list, so coming back shows the row you were on. */
  // svelte-ignore state_referenced_locally
  let cursor = $state(ListCursors.get(model.definition.id));
  $effect(() => ListCursors.set(model.definition.id, cursor));
  let container: HTMLElement | undefined = $state();

  $effect(() => {
    if (cursor >= model.rows.length) cursor = model.rows.length - 1;
  });

  function move(delta: number) {
    if (!model.rows.length) return;
    cursor = cursor < 0 ? (delta > 0 ? 0 : model.rows.length - 1) : Math.min(Math.max(cursor + delta, 0), model.rows.length - 1);
    void tick().then(() => container?.querySelector('tr.cursor')?.scrollIntoView({ block: 'nearest' }));
  }

  // Lists with clickable rows take the list keys while mounted (the newest list wins, e.g. one in an open window).
  const navigable = () => !!onopen && model.rows.length > 0;
  useCommands(commands, {
    'list.next': { run: () => move(1), when: navigable },
    'list.previous': { run: () => move(-1), when: navigable },
    'list.open': { run: () => onopen?.(model.rows[cursor]), when: () => navigable() && cursor >= 0 && cursor < model.rows.length },
    'list.search': {
      run: () => container?.querySelector<HTMLInputElement>('input[type="search"]')?.focus(),
      when: () => !!onopen && toolbar && model.searchable,
    },
    'list.menu': {
      run: () => {
        const row = container?.querySelector('tr.cursor');
        if (row && menu) openMenuAt(row, menu(model.rows[cursor]));
      },
      when: () => !!menu && navigable() && cursor >= 0 && cursor < model.rows.length,
    },
    'list.reset': { run: () => model.reset(), when: () => !!onopen && model.activeFilters > 0 },
  });

  function sortState(column: ListColumn<T>): 'ascending' | 'descending' | 'none' {
    if (model.sort.key !== column.key) return 'none';
    return model.sort.dir === 'asc' ? 'ascending' : 'descending';
  }
</script>

<div class="list" bind:this={container}>
  {#if toolbar}<ListToolbar {model} {actions} {leading} />{/if}

  <AsyncView resource={model.data}>
    {#snippet children()}
      {#if model.rows.length}
        <table aria-busy={model.data.loading}>
          <thead>
            <tr>
              {#if check}<th class="check" scope="col"><span class="visually-hidden">Auswahl</span></th>{/if}
              {#each model.columns as column (column.key)}
                <th scope="col" style:width={column.width} class:end={column.align === 'end'} class:optional={column.hideOnCompact}
                  aria-sort={sortState(column)}>
                  {#if column.sortable === false}
                    {column.label}
                  {:else}
                    <button type="button" class="sort" class:active={model.sort.key === column.key} onclick={() => model.toggleSort(column.key)}
                      {@attach tooltip(() => (model.sort.key === column.key ? 'Sortierrichtung umkehren' : `Nach „${column.label}“ sortieren`))}>
                      {column.label}
                      {#if model.sort.key === column.key}
                        <span class="direction" class:desc={model.sort.dir === 'desc'}><Icon name="expand" small /></span>
                      {/if}
                    </button>
                  {/if}
                </th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each limit === undefined ? model.rows : model.rows.slice(0, limit) as item, rowIndex (rowKey(item))}
              <tr class:clickable={!!onopen} class:selected={selected === rowKey(item)} class:cursor={rowIndex === cursor}
                in:motion.rise|global={{ delay: motion.stagger(rowIndex), distance: 4 }} animate:flip={{ duration: motion.ms('base') }}
                class:checked={!!check?.checked(item)}
                onclick={() => ((cursor = rowIndex), onopen ? onopen(item) : check && !check.disabled?.(item) && check.toggle(item))}
                {@attach menu ? contextMenu(() => ((cursor = rowIndex), menu(item))) : undefined}>
                {#if check}
                  <td class="check">
                    <input type="checkbox" checked={check.checked(item)} disabled={check.disabled?.(item)} aria-label={check.label(item)}
                      onclick={(e) => e.stopPropagation()} onchange={() => check.toggle(item)} />
                  </td>
                {/if}
                {#each model.columns as column, index (column.key)}
                  <td data-label={column.label} class:end={column.align === 'end'} class:optional={column.hideOnCompact} class:primary={index === 0}>
                    {#if index === 0 && onopen}
                      <button type="button" class="open" onclick={(e) => (e.stopPropagation(), onopen(item))}
                        {@attach tooltip(menu ? 'Öffnen; Rechtsklick für weitere Aktionen' : 'Öffnen')}>
                        {#if cell}{@render cell(item, column)}{:else}{model.display(item, column)}{/if}
                      </button>
                    {:else if cell}
                      {@render cell(item, column)}
                    {:else}
                      {model.display(item, column)}
                    {/if}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      {:else}
        <Empty text={model.total ? 'Keine Einträge passen zu Suche und Filtern.' : emptyText}
          action={model.total ? (toolbar && model.activeFilters ? { label: 'Filter zurücksetzen', run: () => model.reset() } : null) : emptyAction} />
      {/if}
    {/snippet}
  </AsyncView>
</div>

<style>
  .list {
    display: grid;
    gap: var(--space-xs);
    min-width: 0;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: auto;
  }
  table {
    transition: opacity var(--motion-base);
  }
  table[aria-busy='true'] {
    opacity: 0.6;
  }
  th,
  td {
    padding: 0 var(--space-sm);
    text-align: left;
    vertical-align: middle;
  }
  th {
    height: 32px;
    border-bottom: 1px solid var(--color-border);
    color: var(--color-text-muted);
    font-size: var(--font-size-small);
    font-weight: var(--font-weight-medium);
    white-space: nowrap;
  }
  td {
    height: 38px;
    border-bottom: 1px solid var(--color-border);
    transition: background var(--motion-fast);
  }
  tbody tr:last-child td {
    border-bottom-color: transparent;
  }
  .end {
    text-align: right;
  }
  .sort {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    height: 24px;
    margin-left: calc(-1 * var(--space-xs));
    padding: 0 var(--space-xs);
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  .sort:hover {
    background: var(--color-hover);
  }
  .sort.active {
    color: var(--color-text);
  }
  .direction {
    display: inline-flex;
    color: var(--color-text-muted);
    transition: rotate var(--motion-base) var(--motion-easing);
  }
  .direction:not(.desc) {
    rotate: 180deg;
  }
  tr.clickable,
  tr:has(td.check input:not(:disabled)) {
    cursor: pointer;
  }
  th.check,
  td.check {
    width: 2.25rem;
    padding-right: 0;
  }
  tr.checked td {
    background: var(--color-accent-soft);
  }
  tbody tr.clickable:hover td {
    background: var(--color-hover);
  }
  tr.selected td {
    background: var(--color-selected);
  }
  tr.cursor td {
    background: var(--color-hover);
  }
  tr.cursor td:first-child {
    box-shadow: inset 2px 0 0 var(--color-accent);
  }
  td:first-child {
    border-radius: var(--radius-md) 0 0 var(--radius-md);
  }
  td:last-child {
    border-radius: 0 var(--radius-md) var(--radius-md) 0;
  }
  .primary {
    font-weight: var(--font-weight-medium);
  }
  .open {
    display: inline-flex;
    align-items: center;
    gap: var(--space-sm);
    max-width: 100%;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  /* Phones: one card per row, column labels in front of the values */
  :global([data-layout='compact']) table,
  :global([data-layout='compact']) tbody,
  :global([data-layout='compact']) tr,
  :global([data-layout='compact']) td {
    display: block;
  }
  :global([data-layout='compact']) thead,
  :global([data-layout='compact']) .optional {
    display: none;
  }
  :global([data-layout='compact']) tr {
    padding: var(--space-sm) 0;
    border-bottom: 1px solid var(--color-border);
  }
  :global([data-layout='compact']) td {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    height: auto;
    min-height: 26px;
    border: 0;
    text-align: left;
  }
  :global([data-layout='compact']) td.check {
    float: left;
    min-height: 0;
    padding-top: 4px;
  }
  :global([data-layout='compact']) td:not(.primary, .check)::before {
    content: attr(data-label);
    flex: 0 0 7rem;
    color: var(--color-text-muted);
    font-size: var(--font-size-small);
  }
</style>
