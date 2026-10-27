<script lang="ts">
  import { bus } from '../../lib/container';
  import { TOAST } from '../../channels';
  import { Action } from '../../lib/state/Action.svelte';
  import { Resource } from '../../lib/state/Resource.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import ChipToggle from '../../ui/ChipToggle.svelte';
  import Field from '../../ui/Field.svelte';
  import type { BoardSettings, OfficeKind } from './MembersApi';
  import { boardSettings, membersApi } from './services';

  /** Einstellungen › Funktionen (admin/board): names, holders and terms of the offices, and the board-wide rules. */
  // A fresh copy to edit; the store keeps the saved settings.
  const settings = new Resource(() => membersApi.boardSettings());
  void settings.load();
  const action = new Action();

  /** Offices one person may hold together with `office`; a pair counts for both, so it shows in both cards. */
  const partners = (value: BoardSettings, office: OfficeKind): OfficeKind[] =>
    value.combinations.flatMap((p) => (p.a === office ? [p.b] : p.b === office ? [p.a] : []));

  function setPartners(value: BoardSettings, office: OfficeKind, next: OfficeKind[]) {
    const others = value.combinations.filter((p) => p.a !== office && p.b !== office);
    value.combinations = [...others, ...next.map((b) => ({ a: office, b }))];
  }

  async function save(event: SubmitEvent, value: BoardSettings) {
    event.preventDefault();
    if (await action.run(async () => (boardSettings.value = await membersApi.saveBoardSettings(value)))) {
      bus.publish(TOAST, { text: 'Funktionen gespeichert.' });
    }
  }
</script>

<AsyncView resource={settings}>
  {#snippet children(value)}
    <form class="stack section" onsubmit={(e) => save(e, value)}>
      <p class="muted">
        Wie die Funktionen im Verein heißen, wie viele sie innehaben, wie lange eine Funktionsperiode dauert und welche Funktionen eine Person
        zugleich innehaben darf.
      </p>
      <div class="cards">
        {#each value.offices as office (office.office)}
          <section class="card stack" class:off={!office.enabled} aria-label={office.label}>
            <div class="row between">
              <input class="name" bind:value={office.label} maxlength="40" aria-label="Bezeichnung" required />
              <label class="check small"><input type="checkbox" bind:checked={office.enabled} disabled={office.office === 'CHAIR'} /> genutzt</label>
            </div>
            {#if office.enabled}
              <div class="row facts">
                <label
                  >Personen
                  <input type="number" min="0" max="20" bind:value={office.minHolders} aria-label="Mindestens: {office.label}" />
                  bis
                  <input
                    type="number"
                    min="1"
                    max="20"
                    placeholder="beliebig"
                    aria-label="Höchstens: {office.label}"
                    bind:value={() => office.maxHolders ?? '', (v) => (office.maxHolders = v === '' || v == null ? null : Math.round(Number(v)))}
                  />
                </label>
                <label>Periode <input type="number" min="1" max="10" bind:value={office.termYears} aria-label="Jahre: {office.label}" /> Jahre</label>
              </div>
              <div class="stack tight">
                <span class="muted small">Zugleich mit</span>
                <ChipToggle
                  label="{office.label} zugleich mit"
                  bind:value={() => partners(value, office.office), (next) => setPartners(value, office.office, next)}
                  options={value.offices.filter((o) => o.enabled && o.office !== office.office).map((o) => ({ value: o.office, label: o.label }))}
                />
              </div>
            {/if}
          </section>
        {/each}
      </div>

      <h3>Vorstand</h3>
      <div class="grid-2">
        <Field label="Mindestens Personen im Vorstand">
          <input type="number" min="1" max="20" bind:value={value.minBoardSize} class="short" />
        </Field>
        <Field label="Kooptieren nach Rücktritt" hint="Wochen; 0 = gleich Nachwahl">
          <input type="number" min="0" max="52" bind:value={value.cooptWeeks} class="short" />
        </Field>
        <Field label="Erinnern vor Ende der Periode" hint="Tage">
          <input type="number" min="1" max="365" bind:value={value.termWarningDays} class="short" />
        </Field>
        <Field label="Frist für die Nachwahl" hint="Tage, ab Ende der Kooptierung">
          <input type="number" min="1" max="365" bind:value={value.byElectionDays} class="short" />
        </Field>
      </div>
      <label class="check"
        ><input type="checkbox" bind:checked={value.oddBoardSize} /> Ungerade Zahl an Personen im Vorstand (Hinweis bei gerader)</label
      >

      <ErrorNote error={action.error} />
      <div><Button type="submit" variant="primary" busy={action.busy}>Speichern</Button></div>
    </form>
  {/snippet}
</AsyncView>

<style>
  p,
  h3 {
    margin: 0;
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
    gap: var(--space-sm);
  }
  .card {
    padding: var(--space-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
  }
  .card.off {
    opacity: 0.6;
  }
  .name {
    flex: 1;
    min-width: 0;
    font-weight: var(--font-weight-medium);
  }
  .between {
    justify-content: space-between;
  }
  .facts {
    flex-wrap: wrap;
    gap: var(--space-md);
    font-size: var(--font-size-small);
  }
  .facts input {
    width: 4.5rem;
  }
  .tight {
    gap: var(--space-xs);
  }
  .short {
    width: 6rem;
  }
</style>
