<script lang="ts">
  import { autofocus } from '../../ui/autofocus';
  import { bus, session } from '../../lib/container';
  import { CreateController } from '../../lib/detail/CreateController.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import Button from '../../ui/Button.svelte';
  import Detail from '../../ui/Detail.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
  import type { Location } from '../locations/model';
  import { locationsApi } from '../locations/services';
  import { TournamentForm } from './TournamentForm.svelte';
  import { tournamentsApi } from './services';

  /** New tournament in the window; teams come next, on the tournament itself. */
  let { handle }: { id: string; handle: WindowHandle } = $props();

  const form = new TournamentForm(session.clock.today());
  // svelte-ignore state_referenced_locally
  const create = new CreateController(bus, handle, 'Neues Turnier');
  let places = $state<Location[]>([]);
  locationsApi.list().then((list) => (places = list), () => {});
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
      <Field label="Spiele" hint="Sätze bis 25, Entscheidungssatz bis 15. Tabelle: 3:0 Punkte für einen klaren Sieg, 2:1 nach dem Entscheidungssatz.">
        <Select bind:value={() => String(form.setsToWin), (v) => (form.setsToWin = Number(v))}
          options={[{ value: '2', label: 'Zwei Gewinnsätze (Best of 3)' }, { value: '3', label: 'Drei Gewinnsätze (Best of 5)' }]} />
      </Field>
    </div>
    <ErrorNote error={create.save.error} />
    <div class="row">
      <Button type="submit" variant="primary" busy={create.save.busy}>Anlegen</Button>
      <Button variant="ghost" onclick={() => handle.close()}>Abbrechen</Button>
    </div>
  </form>
</Detail>
