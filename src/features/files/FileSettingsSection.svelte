<script lang="ts">
  import { Action } from '../../lib/state/Action.svelte';
  import { SettingsDraft } from '../../lib/state/SettingsDraft.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import SettingsForm from '../../ui/SettingsForm.svelte';
  import { filesApi } from './services';

  /** Einstellungen › Dateien (admin/board): how much one member may upload; who manages a folder has no limit there. */
  const load = new Action();
  // In GB with one decimal, stored in MB (server: files_setting.quota_mb, 100 MB to 100 GB).
  const draft = new SettingsDraft({ quotaGb: 2 });
  const toForm = (quotaMb: number) => ({ quotaGb: Math.round((quotaMb / 1024) * 10) / 10 });
  void load.run(async () => draft.load(toForm((await filesApi.settings()).quotaMb)));

  async function save(value: { quotaGb: number }) {
    return toForm((await filesApi.saveSettings({ quotaMb: Math.round(value.quotaGb * 1024) })).quotaMb);
  }
</script>

<div class="stack">
  <ErrorNote error={load.error} />
  <SettingsForm
    title="Speicherplatz"
    intro="Wie viel ein Mitglied insgesamt hochladen darf (Dateien und Versionen). Wer einen Ordner verwaltet, lädt dort ohne Grenze hoch."
    {draft}
    onsave={save}
  >
    <Field label="Je Mitglied" hint="In GB, 0,1 bis 100">
      <input type="number" min="0.1" max="100" step="0.1" bind:value={draft.value.quotaGb} class="short" />
    </Field>
  </SettingsForm>
</div>
