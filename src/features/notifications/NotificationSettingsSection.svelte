<script lang="ts">
  import { SettingsDraft } from '../../lib/state/SettingsDraft.svelte';
  import DataTable from '../../ui/DataTable.svelte';
  import SettingsForm from '../../ui/SettingsForm.svelte';
  import { isImportant, type NotificationKind, type Preference } from './model';
  import { PreferenceListModel } from './PreferenceListModel.svelte';
  import { notificationsApi } from './services';

  /** Einstellungen › Benachrichtigungen: per kind, whether it also comes by push and by e-mail (the inbox gets every one). */
  const draft = new SettingsDraft<Preference[]>([]);
  const list = new PreferenceListModel(async () => {
    const stored = await notificationsApi.preferences();
    draft.load(stored);
    return stored.map((p) => p.kind);
  });
  void list.load();

  const preference = (kind: NotificationKind) => draft.value.find((p) => p.kind === kind);

  function set(kind: NotificationKind, channel: 'push' | 'email', on: boolean) {
    const p = preference(kind);
    if (p && !isImportant(kind)) p[channel] = on;
  }
</script>

<SettingsForm
  title="Benachrichtigungen"
  intro="Im Posteingang erscheint jede Benachrichtigung. Hier legst du fest, was zusätzlich per Push (App) und per E-Mail kommt."
  {draft}
  onsave={(value) => notificationsApi.savePreferences(value)}
>
  <DataTable model={list} rowKey={(row) => row.value} toolbar={false} emptyText="Keine Arten von Benachrichtigungen.">
    {#snippet cell(row, column)}
      {@const p = preference(row.value)}
      {#if column.key === 'label'}
        <span class="kind">
          <span>{row.label}</span>
          <span class="muted small">{row.hint}</span>
        </span>
      {:else if p && (column.key === 'push' || column.key === 'email')}
        <input
          type="checkbox"
          aria-label="{row.label}: {column.label}"
          checked={p[column.key]}
          disabled={isImportant(row.value)}
          onchange={(e) => set(row.value, column.key as 'push' | 'email', e.currentTarget.checked)}
        />
      {/if}
    {/snippet}
  </DataTable>
</SettingsForm>

<style>
  .kind {
    display: grid;
    gap: var(--space-xxs);
    padding-block: var(--space-xs);
    white-space: normal;
  }
</style>
