<script lang="ts">
  import { bus } from '../../lib/container';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import { NOTIFICATION_SETTINGS_CHANGED } from './NotificationCenter.svelte';
  import { settings } from '../../settings';
  import { SettingsDraft } from '../../lib/state/SettingsDraft.svelte';
  import DataTable from '../../ui/DataTable.svelte';
  import Field from '../../ui/Field.svelte';
  import SettingsForm from '../../ui/SettingsForm.svelte';
  import type { NotificationKind, NotificationSettings } from './model';
  import { PreferenceListModel } from './PreferenceListModel.svelte';
  import { notificationsApi } from './services';

  /** Einstellungen › Benachrichtigungs-Regeln (admin/board): important kinds, defaults per kind, how long inbox and activity stay. */
  const draft = new SettingsDraft<NotificationSettings>({ importantKinds: [], defaults: [], inboxRetentionDays: 90, activityRetentionDays: 730 });
  const list = new PreferenceListModel(async () => {
    draft.load(await notificationsApi.settings());
    return draft.value.defaults.map((d) => d.kind);
  }, true);
  void list.load();
  useBus(bus, NOTIFICATION_SETTINGS_CHANGED, () => void notificationsApi.settings().then((s) => draft.refresh(s)));

  const preference = (kind: NotificationKind) => draft.value.defaults.find((p) => p.kind === kind);

  function setImportant(kind: NotificationKind, on: boolean) {
    const rest = draft.value.importantKinds.filter((k) => k !== kind);
    draft.value.importantKinds = on ? [...rest, kind] : rest;
  }
</script>

<SettingsForm
  title="Benachrichtigungs-Regeln"
  intro="Wichtige Arten gehen immer per Push und E-Mail hinaus. Die übrigen Häkchen gelten, bis ein Mitglied selbst wählt."
  {draft}
  onsave={(value) => notificationsApi.saveSettings(value)}
>
  <DataTable model={list} rowKey={(row) => row.value} toolbar={false} emptyText="Keine Arten von Benachrichtigungen.">
    {#snippet cell(row, column)}
      {@const p = preference(row.value)}
      {#if column.key === 'label'}
        <span>{row.label}</span>
      {:else if column.key === 'important'}
        <input
          type="checkbox"
          aria-label="{row.label}: wichtig"
          checked={draft.value.importantKinds.includes(row.value)}
          onchange={(e) => setImportant(row.value, e.currentTarget.checked)}
        />
      {:else if p && (column.key === 'push' || column.key === 'email')}
        <input
          type="checkbox"
          aria-label="{row.label}: {column.label} als Vorgabe"
          checked={p[column.key]}
          onchange={(e) => (p[column.key as 'push' | 'email'] = e.currentTarget.checked)}
        />
      {/if}
    {/snippet}
  </DataTable>
  <Field
    label="Posteingang aufbewahren"
    hint="Tage, {settings.notifications.inboxRetentionDays.min} bis {settings.notifications.inboxRetentionDays
      .max}; ältere Benachrichtigungen werden gelöscht."
  >
    <input
      type="number"
      min={settings.notifications.inboxRetentionDays.min}
      max={settings.notifications.inboxRetentionDays.max}
      bind:value={draft.value.inboxRetentionDays}
      class="short"
    />
  </Field>
  <Field
    label="Verlauf aufbewahren"
    hint="Tage, {settings.notifications.activityRetentionDays.min} bis {settings.notifications.activityRetentionDays
      .max}; ältere Einträge im Verlauf von Aufgaben, Terminen und Dateien werden gelöscht."
  >
    <input
      type="number"
      min={settings.notifications.activityRetentionDays.min}
      max={settings.notifications.activityRetentionDays.max}
      bind:value={draft.value.activityRetentionDays}
      class="short"
    />
  </Field>
</SettingsForm>
