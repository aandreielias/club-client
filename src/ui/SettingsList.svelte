<script lang="ts" module>
  import type { Hue } from '../lib/types';

  export interface SettingsRow {
    key: string;
    label: string;
    /** Short facts next to the name. */
    detail: string;
    /** Shows the name as a coloured tag (e.g. appointment types). */
    hue?: Hue;
    archived: boolean;
    /** Removing it archives instead of deleting. */
    inUse: boolean;
    /** Small grey tags after the name (e.g. "fest"). */
    tags?: readonly string[];
  }
</script>

<script lang="ts">
  import { bus } from '../lib/container';
  import { WINDOW_OPEN } from '../channels';
  import { BUTTON_TOOLTIPS } from '../tooltips';
  import Button from './Button.svelte';
  import Empty from './Empty.svelte';
  import ErrorNote from './ErrorNote.svelte';
  import SortableList from './SortableList.svelte';
  import Tag from './Tag.svelte';
  import { tooltip } from './tooltip';

  /**
   * The club's types or kinds in Einstellungen: each row opens its window and can be removed (archived while used); archived rows
   * show on request and come back with "Wiederherstellen". Fixed rows have no remove button. While `loading` placeholder lines
   * show, a failed load shows `error` with retry, no rows `emptyText` with the create button. With `onreorder`, "Reihenfolge ändern"
   * lets the rows be dragged (or moved with the keyboard).
   */
  let {
    rows,
    kind,
    newLabel,
    onremove,
    onrestore,
    onreorder,
    fixed = () => false,
    loading = false,
    error = null,
    onretry,
    emptyText = 'Noch keine Einträge.',
  }: {
    rows: readonly SettingsRow[];
    kind: string;
    newLabel: string;
    onremove: (row: SettingsRow) => void;
    /** Without it, records are only deleted, never archived (e.g. mailboxes). */
    onrestore?: (row: SettingsRow) => void;
    onreorder?: (keys: string[]) => void | Promise<unknown>;
    fixed?: (row: SettingsRow) => boolean;
    loading?: boolean;
    error?: unknown;
    onretry?: () => void;
    emptyText?: string;
  } = $props();

  let sorting = $state(false);

  let showArchived = $state(false);
  const shown = $derived(rows.filter((r) => showArchived || !r.archived));
  const archivedCount = $derived(rows.filter((r) => r.archived).length);

  const open = (id: string) => bus.publish(WINDOW_OPEN, { kind, id });
  const create = () => bus.publish(WINDOW_OPEN, { kind: `${kind}-new`, id: '-' });
</script>

{#if error}
  <div class="stack">
    <ErrorNote {error} />
    {#if onretry}<div><Button onclick={onretry}>Erneut versuchen</Button></div>{/if}
  </div>
{:else if loading}
  <div class="loading" aria-busy="true" aria-label="Laden">
    <span class="skeleton"></span><span class="skeleton"></span><span class="skeleton"></span>
  </div>
{:else if !rows.length}
  <Empty text={emptyText} action={{ label: newLabel, icon: 'add', run: create }} />
{:else if sorting && onreorder}
  <SortableList
    items={rows.filter((r) => !r.archived).map((r) => ({ key: r.key, label: r.label }))}
    label="Reihenfolge"
    onreorder={(keys) => void onreorder(keys)}
  />
  <div class="row between">
    <span class="muted small">Ziehen oder mit Leertaste und Pfeiltasten verschieben.</span>
    <Button variant="primary" onclick={() => (sorting = false)}>Fertig</Button>
  </div>
{:else}
  <ul class="rows">
    {#each shown as row (row.key)}
      <li class:archived={row.archived}>
        <button type="button" class="row-button" onclick={() => open(row.key)} {@attach tooltip(`${row.label} öffnen`)}>
          {#if row.hue}<Tag tone={row.hue}>{row.label}</Tag>{:else}<span class="name">{row.label}</span>{/if}
          {#each row.tags ?? [] as tag (tag)}<Tag tone="gray">{tag}</Tag>{/each}
          <span class="muted small detail">{row.detail}</span>
          {#if row.archived}<Tag tone="gray">Archiviert</Tag>{/if}
        </button>
        {#if row.archived && onrestore}
          <Button size="sm" variant="ghost" tooltip="{row.label} wieder verwenden" onclick={() => onrestore(row)}>Wiederherstellen</Button>
        {:else if !fixed(row)}
          <Button
            size="sm"
            variant="ghost"
            icon="delete"
            tooltip={row.inUse && onrestore ? `${row.label} archivieren (wird verwendet)` : `${row.label} löschen`}
            onclick={() => onremove(row)}
          />
        {/if}
      </li>
    {/each}
  </ul>
  <div class="row between">
    <div class="row">
      <Button icon="add" tooltip={BUTTON_TOOLTIPS[newLabel]?.text ?? newLabel} onclick={create}>{newLabel}</Button>
      {#if onreorder && rows.filter((r) => !r.archived).length > 1}
        <Button variant="ghost" icon="sort" tooltip="Die Reihenfolge der Einträge ändern" onclick={() => (sorting = true)}>Reihenfolge ändern</Button>
      {/if}
    </div>
    {#if archivedCount}
      <label class="check muted small"><input type="checkbox" bind:checked={showArchived} /> Archivierte anzeigen ({archivedCount})</label>
    {/if}
  </div>
{/if}

<style>
  .rows {
    display: grid;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
  }
  li.archived .row-button {
    opacity: 0.6;
  }
  .row-button {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    width: 100%;
    min-height: 34px;
    padding: var(--space-xs) var(--space-sm);
    border: 0;
    border-radius: var(--radius-md);
    background: none;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }
  .row-button:hover {
    background: var(--color-hover);
  }
  .name {
    font-weight: var(--font-weight-medium);
  }
  .detail {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .loading {
    display: grid;
    gap: var(--space-sm);
    padding: var(--space-sm) 0;
  }
  .loading span {
    display: block;
    height: 1.6rem;
  }
</style>
