<script lang="ts">
  import { bus } from '../../lib/container';
  import { Action } from '../../lib/state/Action.svelte';
  import { SettingsDraft } from '../../lib/state/SettingsDraft.svelte';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
  import SettingsForm from '../../ui/SettingsForm.svelte';
  import SettingsList from '../../ui/SettingsList.svelte';
  import { allActions, isOwnAction, MAJORITY_LABELS, QUORUM_LABELS, SEEDED_CIRCULAR, type CircularRules, type Quorum } from './model';
  import { setRuleEnabled } from './ruleActions';
  import { meetingsApi, resolutionRules } from './services';

  /**
   * Einstellungen › Beschlüsse (admin/board): how circular votes of the board run, then every decision with the majority it fixes and the
   * tasks that follow; each opens in the window, the club adds its own.
   */
  const load = new Action();
  const draft = new SettingsDraft<CircularRules>(SEEDED_CIRCULAR);
  const reload = () => void load.run(async () => draft.load((await resolutionRules.load()).circular));
  reload();

  const QUORUMS = (Object.keys(QUORUM_LABELS) as Quorum[]).map((q) => ({ value: q, label: `${QUORUM_LABELS[q]} des Vorstands` }));

  /** Only the circular rules change; the decisions are sent as the server has them now. */
  async function saveCircular(circular: CircularRules): Promise<CircularRules> {
    const saved = await meetingsApi.saveResolutionRules({ ...(await meetingsApi.resolutionRules()), circular });
    resolutionRules.value = saved;
    return saved.circular;
  }

  const rows = $derived(
    allActions(resolutionRules.value.items)
      .map((action) => resolutionRules.get(action))
      .filter((rule) => !!rule)
      .map((rule) => {
        const action = rule.action!;
        const tasks = rule.followUps.length;
        return {
          key: action,
          label: resolutionRules.label(action).replace(/ \(entfernt\)$/, ''),
          tags: isOwnAction(action) ? [] : ['eingebaut'],
          detail: [
            rule.majority ? MAJORITY_LABELS[rule.majority] : 'Mehrheit frei',
            tasks ? `${tasks} ${tasks === 1 ? 'Folgeaufgabe' : 'Folgeaufgaben'}` : 'ohne Folgeaufgaben',
          ].join(' · '),
          archived: !rule.enabled,
          inUse: true,
        };
      }),
  );
</script>

<div class="stack section">
  <SettingsForm title="Umlaufbeschlüsse des Vorstands" intro="Abstimmungen ohne Sitzung, schriftlich in der App." {draft} onsave={saveCircular}>
    <div class="grid-2">
      <Field label="Abstimmen mindestens" hint="Stunden ab dem Öffnen (1 bis 720)">
        <input type="number" min="1" max="720" bind:value={draft.value.minHours} class="short" />
      </Field>
      <Field label="Gültig, wenn teilnehmen">
        <Select bind:value={draft.value.quorum} options={QUORUMS} aria-label="Nötige Beteiligung" />
      </Field>
    </div>
  </SettingsForm>

  <section class="stack">
    <h2>Beschlussarten</h2>
    <p class="muted small">
      Was ein Beschluss entscheidet, bringt seine Mehrheit und seine Folgeaufgaben mit. Welche Beschlüsse eine Sitzung fassen darf, steht bei der
      Sitzungsart. Entfernte Beschlussarten sind nirgends mehr wählbar; gefasste Beschlüsse bleiben.
    </p>
    <SettingsList
      {rows}
      kind="resolution-rule"
      newLabel="Neue Beschlussart"
      onremove={(row) => setRuleEnabled(bus, row.key, false)}
      onrestore={(row) => setRuleEnabled(bus, row.key, true)}
      fixed={(row) => row.key === 'GENERAL'}
      loading={load.busy && !rows.length}
      error={load.error}
      onretry={reload}
      emptyText="Noch keine Beschlussarten."
    />
  </section>
</div>

<style>
  p,
  h2 {
    margin: 0;
  }
  h2 {
    font-size: var(--font-size-base);
  }
  .short {
    width: 6rem;
  }
</style>
