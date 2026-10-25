<script lang="ts">
  import { bus } from '../../lib/container';
  import { TOAST } from '../../channels';
  import { Action } from '../../lib/state/Action.svelte';
  import { Resource } from '../../lib/state/Resource.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import type { BoardSettings } from './MembersApi';
  import { boardSettings, membersApi } from './services';

  /** Einstellungen › Funktionen (admin/board): names, holders and terms of the offices, and the board-wide rules. */
  const settings = new Resource(async () => structuredClone(await boardSettings.load()));
  void settings.load();
  const action = new Action();

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
        Wie die Funktionen im Verein heißen, wie viele sie innehaben und wie lange eine Funktionsperiode dauert. Welche Funktionen eine
        Person zugleich innehaben darf, ist fest geregelt (Stellvertretung auch Kassa oder Schriftführung, Rechnungsprüfung außerhalb des
        Vorstands).
      </p>
      <div class="table" role="table" aria-label="Funktionen">
        <div class="head" role="row">
          <span role="columnheader">Bezeichnung</span><span role="columnheader">Genutzt</span><span role="columnheader">Mindestens</span>
          <span role="columnheader">Höchstens</span><span role="columnheader">Jahre</span>
        </div>
        {#each value.offices as office (office.office)}
          <div class="line" role="row">
            <input bind:value={office.label} maxlength="40" aria-label="Bezeichnung" required />
            <input type="checkbox" bind:checked={office.enabled} disabled={office.office === 'CHAIR'} aria-label="Genutzt: {office.label}" />
            <input type="number" min="0" max="20" bind:value={office.minHolders} aria-label="Mindestens: {office.label}" />
            <input type="number" min="1" max="20" placeholder="beliebig" aria-label="Höchstens: {office.label}"
              bind:value={() => office.maxHolders ?? '', (v) => (office.maxHolders = v === '' || v == null ? null : Math.round(Number(v)))} />
            <input type="number" min="1" max="10" bind:value={office.termYears} aria-label="Jahre: {office.label}" />
          </div>
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
      <label class="check"><input type="checkbox" bind:checked={value.oddBoardSize} /> Ungerade Zahl an Personen im Vorstand (Hinweis bei gerader)</label>

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
  .table {
    display: grid;
    gap: var(--space-xs);
  }
  .head,
  .line {
    display: grid;
    grid-template-columns: minmax(10rem, 1fr) 4rem 6rem 6rem 5rem;
    gap: var(--space-sm);
    align-items: center;
  }
  .head {
    color: var(--color-text-muted);
    font-size: var(--font-size-small);
  }
  .line input[type='checkbox'] {
    justify-self: start;
  }
  .short {
    width: 6rem;
  }
</style>
