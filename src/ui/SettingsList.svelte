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
  }
</script>

<script lang="ts">
  import { bus } from '../lib/container';
  import { WINDOW_OPEN } from '../channels';
  import { BUTTON_TOOLTIPS } from '../tooltips';
  import Button from './Button.svelte';
  import Tag from './Tag.svelte';
  import { tooltip } from './tooltip';

  /**
   * The club's types or kinds in Einstellungen: each row opens its window and can be removed (archived while used); archived rows
   * show on request and come back with "Wiederherstellen". Rows without `onremove` (fixed ones) have no remove button.
   */
  let {
    rows,
    kind,
    newLabel,
    onremove,
    onrestore,
    fixed = () => false,
  }: {
    rows: readonly SettingsRow[];
    kind: string;
    newLabel: string;
    onremove: (row: SettingsRow) => void;
    onrestore: (row: SettingsRow) => void;
    fixed?: (row: SettingsRow) => boolean;
  } = $props();

  let showArchived = $state(false);
  const shown = $derived(rows.filter((r) => showArchived || !r.archived));
  const archivedCount = $derived(rows.filter((r) => r.archived).length);

  const open = (id: string) => bus.publish(WINDOW_OPEN, { kind, id });
</script>

<ul class="rows">
  {#each shown as row (row.key)}
    <li class:archived={row.archived}>
      <button type="button" class="row-button" onclick={() => open(row.key)} {@attach tooltip(`${row.label} öffnen`)}>
        {#if row.hue}<Tag tone={row.hue}>{row.label}</Tag>{:else}<span class="name">{row.label}</span>{/if}
        <span class="muted small">{row.detail}</span>
        {#if row.archived}<Tag tone="gray">Archiviert</Tag>{/if}
      </button>
      {#if row.archived}
        <Button size="sm" variant="ghost" tooltip="{row.label} wieder verwenden" onclick={() => onrestore(row)}>Wiederherstellen</Button>
      {:else if !fixed(row)}
        <Button
          size="sm"
          variant="ghost"
          icon="delete"
          tooltip={row.inUse ? `${row.label} archivieren (wird verwendet)` : `${row.label} löschen`}
          onclick={() => onremove(row)}
        />
      {/if}
    </li>
  {/each}
</ul>
<div class="row between">
  <Button tooltip={BUTTON_TOOLTIPS[newLabel]?.text ?? newLabel} onclick={() => bus.publish(WINDOW_OPEN, { kind: `${kind}-new`, id: '-' })}
    >{newLabel}</Button
  >
  {#if archivedCount}
    <label class="check muted small"><input type="checkbox" bind:checked={showArchived} /> Archivierte anzeigen ({archivedCount})</label>
  {/if}
</div>

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
</style>
