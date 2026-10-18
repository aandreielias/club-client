<script lang="ts">
  import { bus } from '../../lib/container';
  import { CreateController } from '../../lib/detail/CreateController.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import Detail from '../../ui/Detail.svelte';
  import LocationEditor from './LocationEditor.svelte';
  import { LocationForm } from './LocationForm.svelte';
  import { locationsApi } from './services';

  /** New place in the window; afterwards the window shows it. */
  let { handle }: { id: string; handle: WindowHandle } = $props();

  const form = LocationForm.blank();
  // svelte-ignore state_referenced_locally
  const create = new CreateController(bus, handle, 'Neuer Ort');

  const submit = () => create.submit(async () => (await locationsApi.create(form.toNew())).id, 'location', 'Ort angelegt.');
</script>

<Detail title="Neuer Ort">
  <LocationEditor {form} action={create.save} submitLabel="Anlegen" oncancel={() => handle.close()} onsubmit={submit} />
</Detail>
