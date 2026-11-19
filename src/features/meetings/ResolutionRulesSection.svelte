<script lang="ts">
  import { settings } from '../../settings';
  import { Action } from '../../lib/state/Action.svelte';
  import { SettingsDraft } from '../../lib/state/SettingsDraft.svelte';
  import Field from '../../ui/Field.svelte';
  import OptionList from '../../ui/OptionList.svelte';
  import Select from '../../ui/Select.svelte';
  import SettingsForm from '../../ui/SettingsForm.svelte';
  import QuorumField from './QuorumField.svelte';
  import {
    MAJORITY_BASE_HINTS,
    MAJORITY_BASE_LABELS,
    MAJORITY_LABELS,
    SEEDED_CIRCULAR,
    TASK_FALLBACK_LABELS,
    type CircularRules,
    type Majority,
    type MajorityBase,
    type TaskFallback,
  } from './model';
  import { meetingsApi, resolutionRules } from './services';

  /**
   * Einstellungen › Beschlüsse (admin/board): how circular votes of the board run. Beschlüsse themselves are entered with each Sitzung;
   * every passed one gets its task "umsetzen".
   */
  const load = new Action();
  const draft = new SettingsDraft<CircularRules>(SEEDED_CIRCULAR);
  const reload = () => void load.run(async () => draft.load((await resolutionRules.load()).circular));
  reload();

  const MAJORITIES = (Object.keys(MAJORITY_LABELS) as Majority[]).map((m) => ({ value: m, label: MAJORITY_LABELS[m] }));
  const BASES = (Object.keys(MAJORITY_BASE_LABELS) as MajorityBase[]).map((b) => ({ value: b, label: MAJORITY_BASE_LABELS[b] }));

  async function saveCircular(circular: CircularRules): Promise<CircularRules> {
    const saved = await meetingsApi.saveResolutionRules({ circular, taskFallback: resolutionRules.value?.taskFallback ?? 'BOARD' });
    resolutionRules.value = saved;
    return saved.circular;
  }

  const fallback = new SettingsDraft<{ taskFallback: TaskFallback }>({ taskFallback: 'BOARD' });
  const reloadFallback = () => void load.run(async () => fallback.load({ taskFallback: (await resolutionRules.load()).taskFallback }));
  reloadFallback();
  const FALLBACKS = (Object.keys(TASK_FALLBACK_LABELS) as TaskFallback[]).map((f) => ({ value: f, label: TASK_FALLBACK_LABELS[f] }));

  async function saveFallback(value: { taskFallback: TaskFallback }): Promise<{ taskFallback: TaskFallback }> {
    const saved = await meetingsApi.saveResolutionRules({ circular: (await resolutionRules.load()).circular, taskFallback: value.taskFallback });
    resolutionRules.value = saved;
    return { taskFallback: saved.taskFallback };
  }
</script>

<div class="stack">
  <SettingsForm
    title="Umlaufbeschlüsse des Vorstands"
    intro="Abstimmungen ohne Sitzung, schriftlich in der App. Jeder angenommene Beschluss bekommt eine Aufgabe „umsetzen“."
    {draft}
    onsave={saveCircular}
  >
    <div class="grid-2">
      <Field label="Abstimmen mindestens" hint="Stunden ab dem Öffnen (1 bis 720)">
        <input type="number" min="1" max={settings.meetings.maxCircularMinHours} bind:value={draft.value.minHours} class="short" />
      </Field>
      <Field label="Erinnern" hint="Stunden vor dem Ende, an wer noch nicht abgestimmt hat (1 bis 720)">
        <input type="number" min="1" max={settings.meetings.maxCircularMinHours} bind:value={draft.value.remindHours} class="short" />
      </Field>
    </div>
    <QuorumField bind:value={draft.value.quorum} of="des Vorstands stimmt ab" />
    <OptionList label="Mögliche Mehrheiten" options={MAJORITIES} bind:value={draft.value.majorities} />
    <Field label="Gezählt werden" hint={MAJORITY_BASE_HINTS[draft.value.majorityBase]}>
      <Select bind:value={draft.value.majorityBase} options={BASES} aria-label="Gezählt werden" />
    </Field>
  </SettingsForm>
  <SettingsForm
    title="Umsetzen ohne Zuständige"
    intro="Wer die Aufgabe „umsetzen“ bekommt, wenn ein Beschluss niemanden nennt."
    draft={fallback}
    onsave={saveFallback}
  >
    <Field label="Aufgabe an">
      <Select bind:value={fallback.value.taskFallback} options={FALLBACKS} aria-label="Aufgabe an" />
    </Field>
  </SettingsForm>
</div>
