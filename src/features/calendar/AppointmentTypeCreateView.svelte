<script lang="ts">
  import { bus } from '../../lib/container';
  import { CreateController } from '../../lib/detail/CreateController.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import Detail from '../../ui/Detail.svelte';
  import AppointmentTypeEditor from './AppointmentTypeEditor.svelte';
  import type { AppointmentTypeInput } from './model';
  import { appointmentTypes, calendarApi } from './services';

  /** New appointment type in the window; afterwards the window shows it. */
  let { handle }: { id: string; handle: WindowHandle } = $props();

  const form = $state<AppointmentTypeInput>({ label: '', hue: 'blue', rides: false, cabins: true, sort: 10, archived: false });
  // svelte-ignore state_referenced_locally
  const create = new CreateController(bus, handle, 'Neue Terminart');

  const submit = () => create.submit(async () => {
    const saved = await calendarApi.saveType(null, { ...form, label: form.label.trim() });
    await appointmentTypes.load();
    return saved.key;
  }, 'appointment-type', 'Terminart angelegt.');
</script>

<Detail title="Neue Terminart">
  <AppointmentTypeEditor {form} action={create.save} submitLabel="Anlegen" canArchive={false} oncancel={() => handle.close()} onsubmit={submit} />
</Detail>
