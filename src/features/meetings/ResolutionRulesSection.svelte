<script lang="ts">
  import { Action } from '../../lib/state/Action.svelte';
  import { SettingsDraft } from '../../lib/state/SettingsDraft.svelte';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
  import SettingsForm from '../../ui/SettingsForm.svelte';
  import { QUORUM_LABELS, SEEDED_CIRCULAR, type CircularRules, type Quorum } from './model';
  import { meetingsApi, resolutionRules } from './services';

  /**
   * Einstellungen › Beschlüsse (admin/board): how circular votes of the board run. Beschlüsse themselves are entered with each Sitzung;
   * every passed one gets its task "umsetzen".
   */
  const load = new Action();
  const draft = new SettingsDraft<CircularRules>(SEEDED_CIRCULAR);
  const reload = () => void load.run(async () => draft.load((await resolutionRules.load()).circular));
  reload();

  const QUORUMS = (Object.keys(QUORUM_LABELS) as Quorum[]).map((q) => ({ value: q, label: `${QUORUM_LABELS[q]} des Vorstands` }));

  async function saveCircular(circular: CircularRules): Promise<CircularRules> {
    const saved = await meetingsApi.saveResolutionRules({ circular });
    resolutionRules.value = saved;
    return saved.circular;
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
        <input type="number" min="1" max="720" bind:value={draft.value.minHours} class="short" />
      </Field>
      <Field label="Gültig, wenn teilnehmen">
        <Select bind:value={draft.value.quorum} options={QUORUMS} aria-label="Nötige Beteiligung" />
      </Field>
    </div>
  </SettingsForm>
</div>
