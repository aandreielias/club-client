<script lang="ts">
  import { bus, session } from '../../lib/container';
  import { CreateController } from '../../lib/detail/CreateController.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import Detail from '../../ui/Detail.svelte';
  import HolidayEditor from './HolidayEditor.svelte';
  import type { Holiday } from './model';
  import { calendarApi, holidays } from './services';

  /** New holiday in the window; afterwards the window shows it. */
  let { handle }: { id: string; handle: WindowHandle } = $props();

  const today = session.clock.today();
  const form = $state<Omit<Holiday, 'id'>>({ name: '', from: today, to: today });
  // svelte-ignore state_referenced_locally
  const create = new CreateController(bus, handle, 'Neue Ferien');

  const submit = () =>
    create.submit(
      async () => {
        const saved = await calendarApi.saveHoliday(null, { ...form, name: form.name.trim() });
        await holidays.load();
        return saved.id;
      },
      'holiday',
      'Ferien eingetragen.',
    );
</script>

<Detail title="Neue Ferien">
  <HolidayEditor {form} action={create.save} submitLabel="Eintragen" oncancel={() => handle.close()} onsubmit={submit} />
</Detail>
