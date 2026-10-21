<script lang="ts">
  import { autofocus } from '../../ui/autofocus';
  import { bus, session } from '../../lib/container';
  import { CreateController } from '../../lib/detail/CreateController.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import Button from '../../ui/Button.svelte';
  import Detail from '../../ui/Detail.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import TournamentFields from './TournamentFields.svelte';
  import { TournamentForm } from './TournamentForm.svelte';
  import { tournamentsApi } from './services';

  /** New tournament in the window; teams come next, on the tournament itself. */
  let { handle }: { id: string; handle: WindowHandle } = $props();

  const form = new TournamentForm(session.clock.today());
  // svelte-ignore state_referenced_locally
  const create = new CreateController(bus, handle, 'Neues Turnier');

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    form.submitted = true;
    if (form.valid) await create.submit(async () => (await tournamentsApi.create(form.toNew())).id, 'tournament',
        form.teamNames.length ? 'Turnier angelegt.' : 'Turnier angelegt. Jetzt die Teams eintragen.');
  }
</script>

<Detail title="Neues Turnier">
  <form class="stack" onsubmit={submit} novalidate {@attach autofocus}>
    <TournamentFields {form} />
    <ErrorNote error={create.save.error} />
    <div class="row">
      <Button type="submit" variant="primary" busy={create.save.busy}>Anlegen</Button>
      <Button variant="ghost" onclick={() => handle.close()}>Abbrechen</Button>
    </div>
  </form>
</Detail>
