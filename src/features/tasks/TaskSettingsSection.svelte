<script lang="ts">
  import { bus } from '../../lib/container';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import { TASK_SETTINGS_CHANGED } from './events';
  import { settings } from '../../settings';
  import { Action } from '../../lib/state/Action.svelte';
  import { SettingsDraft } from '../../lib/state/SettingsDraft.svelte';
  import type { TaskSettings } from './model';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import SettingsForm from '../../ui/SettingsForm.svelte';
  import { taskSettings, tasksApi } from './services';

  /** Einstellungen › Aufgaben (admin/board): when the people of a task hear that it is due or overdue, and when it escalates. */
  const load = new Action();
  const draft = new SettingsDraft<TaskSettings>({ remindHours: 24, overdueRepeatDays: 0, escalateAfterDays: 0 });
  void load.run(async () => draft.load(await tasksApi.settings()));
  useBus(bus, TASK_SETTINGS_CHANGED, () => void tasksApi.settings().then((s) => draft.refresh(s)));
</script>

<div class="stack">
  <ErrorNote error={load.error} />
  <SettingsForm
    title="Erinnerung an fällige Aufgaben"
    intro="Wer eine Aufgabe übernommen hat (und bei Minderjährigen die Eltern), wird vor der Fälligkeit erinnert und hört, wenn sie überfällig ist."
    {draft}
    onsave={async (value) => {
      const saved = await tasksApi.saveSettings(value);
      taskSettings.set(saved);
      return saved;
    }}
  >
    <Field label="Erinnern vor der Fälligkeit" hint="Stunden, 1 bis 336 (zwei Wochen)">
      <input type="number" min="1" max={settings.tasks.maxRemindHours} bind:value={draft.value.remindHours} class="short" />
    </Field>
    <Field label="Überfällig erneut melden alle" hint="Tage, 0 = nur einmal melden">
      <input type="number" min="0" max={settings.tasks.maxOverdueRepeatDays} bind:value={draft.value.overdueRepeatDays} class="short" />
    </Field>
    <Field
      label="Eskalieren nach"
      hint="Tage über der Fälligkeit, 0 = nie. Dann hört es einmal, wer die Aufgabe angelegt hat; bei Aufgaben der App der Vorstand."
    >
      <input type="number" min="0" max={settings.tasks.maxEscalateAfterDays} bind:value={draft.value.escalateAfterDays} class="short" />
    </Field>
  </SettingsForm>
</div>
