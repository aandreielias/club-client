<script lang="ts">
  import { bus } from '../../lib/container';
  import { removeRecord, restoreRecord } from '../../lib/detail/removeRecord';
  import { Action } from '../../lib/state/Action.svelte';
  import { SettingsDraft } from '../../lib/state/SettingsDraft.svelte';
  import Field from '../../ui/Field.svelte';
  import SettingsForm from '../../ui/SettingsForm.svelte';
  import SettingsList from '../../ui/SettingsList.svelte';
  import { settings } from '../../settings';
  import { ageProblems, type MembershipRules } from './membershipRules';
  import { HONORARY } from './MembersApi';
  import { boardSettings, membershipKinds } from './services';

  /**
   * Einstellungen › Mitgliedschaft (admin/board): the club's kinds of membership, each opens in the window and the order is dragged;
   * the rules (several kinds per member, minors' ages) are saved together.
   */
  const load = new Action();
  const reload = () => void load.run(() => membershipKinds.load());
  reload();

  const limits = settings.members.ages;
  const draft = new SettingsDraft<MembershipRules>({ multipleKinds: false, guardianUntilAge: 18, ownConsentAge: 14 });
  const rulesLoad = new Action();
  const loadRules = () =>
    void rulesLoad.run(async () => {
      const { multipleKinds, guardianUntilAge, ownConsentAge } = (await boardSettings.load())!;
      draft.load({ multipleKinds, guardianUntilAge, ownConsentAge });
    });
  loadRules();
  const problems = $derived(ageProblems(draft.value, limits));

  /** The rules are part of the board settings: the rest is sent as the server has it now. */
  async function saveRules(rules: MembershipRules): Promise<MembershipRules> {
    const problem = Object.values(ageProblems(rules, limits))[0];
    if (problem) throw new Error(problem);
    const saved = await boardSettings.update((current) => ({ ...current, ...rules }));
    return { multipleKinds: saved.multipleKinds, guardianUntilAge: saved.guardianUntilAge, ownConsentAge: saved.ownConsentAge };
  }

  const rows = $derived(
    membershipKinds.items.map((k) => ({
      key: k.key,
      label: k.label,
      archived: k.archived,
      inUse: k.inUse,
      detail: [
        [k.votes && 'Stimmrecht', k.eligible && 'wählbar'].filter(Boolean).join(' · ') || 'ohne Stimmrecht',
        k.key === HONORARY && 'durch Beschluss vergeben',
      ]
        .filter(Boolean)
        .join(' · '),
    })),
  );
</script>

<div class="stack">
  <section class="stack">
    <h2>Mitgliedsarten</h2>
    <p class="muted small">Wer in der Mitgliederversammlung abstimmt und in eine Funktion gewählt werden kann.</p>
    <SettingsList
      {rows}
      kind="membership-kind"
      newLabel="Neue Mitgliedsart"
      onremove={(row) => removeRecord(bus, row, 'Mitgliedsart', membershipKinds.ops(row.key))}
      onrestore={(row) => restoreRecord(bus, 'Mitgliedsart', membershipKinds.ops(row.key))}
      onreorder={(keys) => load.run(() => membershipKinds.reorder(keys))}
      fixed={(row) => row.key === HONORARY}
      loading={load.busy && !membershipKinds.items.length}
      error={load.error}
      onretry={reload}
      emptyText="Noch keine Mitgliedsarten."
    />
  </section>

  <SettingsForm title="Regeln" intro="Gelten für alle Mitglieder; gespeichert wird gemeinsam." {draft} onsave={saveRules}>
    {#if rulesLoad.error}
      <p class="muted small">Die Regeln konnten nicht geladen werden.</p>
    {:else}
      <label class="check">
        <input type="checkbox" bind:checked={draft.value.multipleKinds} disabled={rulesLoad.busy} />
        Ein Mitglied kann mehrere Mitgliedsarten zugleich haben (z.B. außerordentlich und Ehrenmitglied)
      </label>
      <p class="muted small">Ohne diese Einstellung ersetzt die Ehrenmitgliedschaft die bisherige Art; beim Aberkennen kommt sie zurück.</p>
      <h3>Minderjährige</h3>
      <div class="grid-2 readable">
        <Field
          label="Erziehungsberechtigte handeln bis zum Alter"
          hint="Ab diesem Alter sehen und ändern Eltern nichts mehr für das Mitglied."
          error={problems.guardianUntilAge}
        >
          <input
            type="number"
            min={limits.guardianMin}
            max={limits.guardianMax}
            bind:value={draft.value.guardianUntilAge}
            disabled={rulesLoad.busy}
          />
        </Field>
        <Field
          label="Eigene Foto-Einwilligung ab"
          hint="Darunter geben Erziehungsberechtigte die Einwilligung, ab diesem Alter nur das Mitglied selbst."
          error={problems.ownConsentAge}
        >
          <input
            type="number"
            min={limits.consentMin}
            max={draft.value.guardianUntilAge}
            bind:value={draft.value.ownConsentAge}
            disabled={rulesLoad.busy}
          />
        </Field>
      </div>
    {/if}
  </SettingsForm>
</div>

<style>
  p,
  h2,
  h3 {
    margin: 0;
  }
  h2,
  h3 {
    font-size: var(--font-size-base);
  }
</style>
