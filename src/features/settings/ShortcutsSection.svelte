<script lang="ts">
  import type { CommandId } from '../../shortcuts';
  import { confirmation, keyboard, keymap, store } from '../../lib/container';
  import Button from '../../ui/Button.svelte';
  import DataTable from '../../ui/DataTable.svelte';
  import Kbd from '../../ui/Kbd.svelte';
  import Tag from '../../ui/Tag.svelte';
  import ShortcutRecorder from './ShortcutRecorder.svelte';
  import { ShortcutListModel } from './ShortcutListModel.svelte';

  const list = new ShortcutListModel(keymap, keyboard.isMac, store);
  void list.load();
  let recording = $state<CommandId | null>(null);

  async function resetAll() {
    const ok = await confirmation.ask({
      title: 'Alle Tastenkürzel zurücksetzen',
      message: 'Alle eigenen Änderungen gehen verloren; es gelten wieder die Standardtasten.',
      confirmLabel: 'Zurücksetzen',
      danger: true,
    });
    if (ok) keymap.resetAll();
  }
</script>

<div class="stack section">
  <p class="muted">
    <Kbd keys="Mod+K" /> öffnet die Befehlspalette mit allen Befehlen. Folgen wie <Kbd keys="g k" /> bedeuten: erst G, dann K drücken.
    Änderungen gelten nur in diesem Browser.
  </p>
  <DataTable model={list} rowKey={(row) => row.id} emptyText="Keine Befehle.">
    {#snippet actions()}
      <Button size="sm" variant="ghost" disabled={!Object.keys(keymap.overrides).length} onclick={resetAll}>Alle zurücksetzen</Button>
    {/snippet}
    {#snippet cell(row, column)}
      {#if column.key === 'keys'}
        {#if keymap.keys(row.id)}<Kbd keys={keymap.keys(row.id)} />{:else}<span class="muted small">Keine</span>{/if}
        {#if keymap.isCustom(row.id)}<Tag tone="blue">Geändert</Tag>{/if}
      {:else if column.key === 'actions'}
        <span class="actions">
          <Button size="sm" onclick={() => (recording = row.id)}>Ändern</Button>
          {#if keymap.keys(row.id)}<Button size="sm" variant="ghost" onclick={() => keymap.clear(row.id)} tooltip="Tastenkürzel entfernen">Entfernen</Button>{/if}
          {#if keymap.isCustom(row.id)}<Button size="sm" variant="ghost" onclick={() => keymap.reset(row.id)}>Standard</Button>{/if}
        </span>
      {:else}
        {list.display(row, column)}
      {/if}
    {/snippet}
  </DataTable>
</div>

{#if recording}<ShortcutRecorder id={recording} onclose={() => (recording = null)} />{/if}

<style>
  p {
    margin: 0;
  }
  .actions {
    display: inline-flex;
    gap: var(--space-xs);
  }
</style>
