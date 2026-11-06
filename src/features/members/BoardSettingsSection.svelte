<script lang="ts">
  import { Action } from '../../lib/state/Action.svelte';
  import { SettingsDraft } from '../../lib/state/SettingsDraft.svelte';
  import Field from '../../ui/Field.svelte';
  import SettingsForm from '../../ui/SettingsForm.svelte';
  import SettingsList from '../../ui/SettingsList.svelte';
  import type { BoardSettings } from './MembersApi';
  import { partnersOf } from './OfficeSettingForm.svelte';
  import { boardSettings } from './services';

  /** Einstellungen › Funktionen (admin/board): the board-wide rules, then the offices; each opens in the window. */
  type BoardRules = Pick<BoardSettings, 'minBoardSize' | 'oddBoardSize' | 'cooptWeeks' | 'termWarningDays' | 'byElectionDays'>;
  const rulesOf = ({ minBoardSize, oddBoardSize, cooptWeeks, termWarningDays, byElectionDays }: BoardSettings): BoardRules => ({
    minBoardSize,
    oddBoardSize,
    cooptWeeks,
    termWarningDays,
    byElectionDays,
  });

  const draft = new SettingsDraft<BoardRules>({ minBoardSize: 3, oddBoardSize: false, cooptWeeks: 4, termWarningDays: 60, byElectionDays: 30 });
  const load = new Action();
  const reload = () =>
    void load.run(async () => {
      const settings = await boardSettings.load();
      if (settings) draft.load(rulesOf(settings));
    });
  reload();

  /** The offices are sent as the server has them now. */
  async function saveRules(rules: BoardRules): Promise<BoardRules> {
    return rulesOf(await boardSettings.update((current) => ({ ...current, ...rules })));
  }

  /** The list's order is the club's order of its offices (board page, pickers). */
  async function reorder(keys: string[]) {
    await load.run(() =>
      boardSettings.update((current) => ({ ...current, offices: keys.map((k) => current.offices.find((o) => o.office === k)!).filter(Boolean) })),
    );
  }

  const rows = $derived(
    (boardSettings.value?.offices ?? []).map((o) => {
      const partners = partnersOf(boardSettings.value!, o.office).length;
      return {
        key: o.office,
        label: o.label,
        detail: o.enabled
          ? [
              o.maxHolders == null ? `ab ${o.minHolders} Personen` : `${o.minHolders}–${o.maxHolders} ${o.maxHolders === 1 ? 'Person' : 'Personen'}`,
              `${o.termYears} ${o.termYears === 1 ? 'Jahr' : 'Jahre'}`,
              partners ? `zugleich mit ${partners} weiteren` : '',
            ]
              .filter(Boolean)
              .join(' · ')
          : 'wird nicht mehr vergeben',
        tags: [...(o.board ? [] : ['außerhalb des Vorstands']), ...(o.enabled ? [] : ['nicht besetzt'])],
        archived: false,
        inUse: o.enabled,
      };
    }),
  );
</script>

<div class="stack">
  <SettingsForm title="Vorstand" intro="Regeln für den ganzen Vorstand; Hinweise erscheinen auf der Vorstandsseite." {draft} onsave={saveRules}>
    <div class="grid-2">
      <Field label="Mindestens Personen im Vorstand">
        <input type="number" min="1" max="20" bind:value={draft.value.minBoardSize} class="short" />
      </Field>
      <Field label="Kooptieren nach Rücktritt" hint="Wochen; 0 = gleich Nachwahl">
        <input type="number" min="0" max="52" bind:value={draft.value.cooptWeeks} class="short" />
      </Field>
      <Field label="Erinnern vor Ende der Periode" hint="Tage">
        <input type="number" min="1" max="365" bind:value={draft.value.termWarningDays} class="short" />
      </Field>
      <Field label="Frist für die Nachwahl" hint="Tage, ab Ende der Kooptierung">
        <input type="number" min="1" max="365" bind:value={draft.value.byElectionDays} class="short" />
      </Field>
    </div>
    <label class="check"
      ><input type="checkbox" bind:checked={draft.value.oddBoardSize} /> Ungerade Zahl an Personen im Vorstand (Hinweis bei gerader)</label
    >
  </SettingsForm>

  <section class="stack">
    <h2>Funktionen</h2>
    <p class="muted small">
      Wie die Funktionen heißen, wie viele sie innehaben, wie lange eine Periode dauert und was eine Person zugleich innehaben darf.
    </p>
    <SettingsList
      {rows}
      kind="office-setting"
      newLabel="Neue Funktion"
      onreorder={reorder}
      loading={load.busy && !rows.length}
      error={load.error}
      onretry={reload}
      emptyText="Keine Funktionen."
    />
  </section>
</div>
