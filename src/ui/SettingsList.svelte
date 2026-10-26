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
  }
</script>

<script lang="ts">
  import { bus } from '../lib/container';
  import { WINDOW_OPEN } from '../channels';
  import { BUTTON_TOOLTIPS } from '../tooltips';
  import Button from './Button.svelte';
  import Tag from './Tag.svelte';
  import { tooltip } from './tooltip';

  /** The club's types or kinds in Einstellungen: each row opens its window, the button a new one. */
  let { rows, kind, newLabel }: { rows: readonly SettingsRow[]; kind: string; newLabel: string } = $props();

  const open = (id: string) => bus.publish(WINDOW_OPEN, { kind, id });
</script>

<ul class="rows">
  {#each rows as row (row.key)}
    <li>
      <button type="button" class="row-button" onclick={() => open(row.key)} {@attach tooltip(`${row.label} öffnen`)}>
        {#if row.hue}<Tag tone={row.hue}>{row.label}</Tag>{:else}<span class="name">{row.label}</span>{/if}
        <span class="muted small">{row.detail}</span>
        {#if row.archived}<Tag tone="gray">Archiviert</Tag>{/if}
      </button>
    </li>
  {/each}
</ul>
<div>
  <Button tooltip={BUTTON_TOOLTIPS[newLabel]?.text ?? newLabel} onclick={() => bus.publish(WINDOW_OPEN, { kind: `${kind}-new`, id: '-' })}>{newLabel}</Button>
</div>

<style>
  .rows {
    display: grid;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
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
