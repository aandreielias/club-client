<script lang="ts">
  import { autofocus } from '../../ui/autofocus';
  import { bus, session } from '../../lib/container';
  import { CreateController } from '../../lib/detail/CreateController.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import Button from '../../ui/Button.svelte';
  import ChoiceGroup from '../../ui/ChoiceGroup.svelte';
  import Detail from '../../ui/Detail.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
  import type { Location } from '../locations/model';
  import { locationsApi } from '../locations/services';
  import { FORMAT_LABELS, type TournamentFormat } from './model';
  import { TournamentForm } from './TournamentForm.svelte';
  import { tournamentsApi } from './services';

  /** New tournament in the window; teams come next, on the tournament itself. */
  let { handle }: { id: string; handle: WindowHandle } = $props();

  const form = new TournamentForm(session.clock.today());
  // svelte-ignore state_referenced_locally
  const create = new CreateController(bus, handle, 'Neues Turnier');
  let places = $state<Location[]>([]);
  locationsApi.list().then((list) => (places = list), () => {});
  const formats = (Object.keys(FORMAT_LABELS) as TournamentFormat[]).map((value) => ({ value, label: FORMAT_LABELS[value] }));
  const numbers = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => ({ value: String(from + i), label: String(from + i) }));

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    form.submitted = true;
    if (form.valid) await create.submit(async () => (await tournamentsApi.create(form.toNew())).id, 'tournament', 'Turnier angelegt. Jetzt die Teams eintragen.');
  }
</script>

<Detail title="Neues Turnier">
  <form class="stack" onsubmit={submit} novalidate {@attach autofocus}>
    <Field label="Name" error={form.error('name')}><input bind:value={form.name} maxlength="120" placeholder="z. B. Herbstcup 2026" required /></Field>
    <div class="grid-2">
      <Field label="Von" error={form.error('dates')}><input type="date" bind:value={form.startsOn} required /></Field>
      <Field label="Bis"><input type="date" bind:value={form.endsOn} min={form.startsOn} required /></Field>
    </div>
    <Field label="Ort (optional)">
      <Select bind:value={form.locationId} placeholder="Kein Ort" options={[{ value: '', label: 'Kein Ort' }, ...places.map((l) => ({ value: l.id, label: l.name }))]} />
    </Field>
    <div class="grid-2">
      <Field label="Gruppen" error={form.error('groups')} hint="Jede Gruppe spielt jeder gegen jeden.">
        <Select bind:value={() => String(form.groupCount), (v) => (form.groupCount = Number(v))} options={numbers(1, 8)} />
      </Field>
      <Field label="Weiter je Gruppe" hint="{form.qualifiers} Teams in der KO-Runde.">
        <Select bind:value={() => String(form.advancePerGroup), (v) => (form.advancePerGroup = Number(v))} options={numbers(1, 4)} />
      </Field>
    </div>
    <div class="format">
      <ChoiceGroup name="tournament-format" label="Spielart" options={formats} bind:value={form.format} />
      <p class="muted small">
        {#if form.format === 'VOLLEYBALL'}Teams zu 6. Sätze bis 25, Entscheidungssatz bis 15. Tabelle: 3:0 Punkte für einen klaren Sieg, 2:1 nach dem Entscheidungssatz.
        {:else if form.format === 'BEACH'}Zwei Gewinnsätze, Sätze bis 21, der dritte bis 15. Tabelle: 2 Punkte für einen Sieg, 1 für eine Niederlage.
        {:else}Nur wer gewinnt wird eingetragen, in der Gruppe auch Unentschieden. Tabelle: Sieg 3, Unentschieden 1, Niederlage 0.{/if}
      </p>
    </div>
    {#if form.format === 'VOLLEYBALL'}
      <Field label="Spiele">
        <Select bind:value={() => String(form.setsToWin), (v) => (form.setsToWin = Number(v))}
          options={[{ value: '2', label: 'Zwei Gewinnsätze (Best of 3)' }, { value: '3', label: 'Drei Gewinnsätze (Best of 5)' }]} />
      </Field>
    {:else if form.format === 'BEACH'}
      <Field label="Spieler:innen je Team">
        <Select bind:value={() => String(form.beachTeamSize), (v) => (form.beachTeamSize = Number(v))} options={numbers(2, 4)} />
      </Field>
    {/if}
    <ErrorNote error={create.save.error} />
    <div class="row">
      <Button type="submit" variant="primary" busy={create.save.busy}>Anlegen</Button>
      <Button variant="ghost" onclick={() => handle.close()}>Abbrechen</Button>
    </div>
  </form>
</Detail>

<style>
  .format {
    display: grid;
    gap: var(--space-xs);
  }
  .format p {
    margin: 0;
  }
</style>
