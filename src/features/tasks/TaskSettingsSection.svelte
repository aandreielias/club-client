<script lang="ts">
  import { Action } from '../../lib/state/Action.svelte';
  import { SettingsDraft } from '../../lib/state/SettingsDraft.svelte';
  import type { TaskSettings } from './model';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import SettingsForm from '../../ui/SettingsForm.svelte';
  import { tasksApi } from './services';

  /** Einstellungen › Aufgaben (admin/board): when the people of a task hear that it is due. */
  const load = new Action();
  const draft = new SettingsDraft<TaskSettings>({ remindHours: 24 });
  void load.run(async () => draft.load(await tasksApi.settings()));
</script>

<div class="stack">
  <ErrorNote error={load.error} />
  <SettingsForm
    title="Erinnerung an fällige Aufgaben"
    intro="Wer eine Aufgabe übernommen hat (und bei Minderjährigen die Eltern), wird so lange vor der Fälligkeit einmal erinnert."
    {draft}
    onsave={(value) => tasksApi.saveSettings(value)}
  >
    <Field label="Erinnern vor der Fälligkeit" hint="Stunden, 1 bis 336 (zwei Wochen)">
      <input type="number" min="1" max="336" bind:value={draft.value.remindHours} class="short" />
    </Field>
  </SettingsForm>
</div>
