<script lang="ts">
  import { bus, session } from '../../lib/container';
  import { CreateController } from '../../lib/detail/CreateController.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import Detail from '../../ui/Detail.svelte';
  import EditorForm from '../../ui/EditorForm.svelte';
  import TournamentFields from './TournamentFields.svelte';
  import { TournamentForm } from './TournamentForm.svelte';
  import { tournamentsApi } from './services';

  /** New tournament in the window; teams come next, on the tournament itself. */
  let { handle }: { id: string; handle: WindowHandle } = $props();

  const form = new TournamentForm(session.clock.today());
  // svelte-ignore state_referenced_locally
  const create = new CreateController(bus, handle, 'Neues Turnier');

  const submit = () =>
    create.submit(
      async () => (await tournamentsApi.create(form.toNew())).id,
      'tournament',
      form.teamNames.length ? 'Turnier angelegt.' : 'Turnier angelegt. Jetzt die Teams eintragen.',
    );
</script>

<Detail title="Neues Turnier">
  <EditorForm action={create.save} submitLabel="Anlegen" validate={form} oncancel={() => handle.close()} onsubmit={submit}>
    <TournamentFields {form} />
  </EditorForm>
</Detail>
