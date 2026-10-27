<script lang="ts">
  import { bus } from '../../lib/container';
  import { CreateController } from '../../lib/detail/CreateController.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import Detail from '../../ui/Detail.svelte';
  import MeetingTypeEditor from './MeetingTypeEditor.svelte';
  import { MeetingTypeForm } from './MeetingTypeForm.svelte';
  import { meetingsApi, meetingTypes, resolutionRules } from './services';

  /** New meeting type in the window; afterwards the window shows it. */
  let { handle }: { id: string; handle: WindowHandle } = $props();

  const form = new MeetingTypeForm(null, resolutionRules.value.items);
  // svelte-ignore state_referenced_locally
  const create = new CreateController(bus, handle, 'Neue Sitzungsart');

  const submit = () =>
    create.submit(
      async () => {
        const saved = await meetingsApi.saveType(null, form.toInput());
        await meetingTypes.load();
        return saved.key;
      },
      'meeting-type',
      'Sitzungsart angelegt.',
    );
</script>

<Detail title="Neue Sitzungsart">
  <MeetingTypeEditor {form} action={create.save} submitLabel="Anlegen" canArchive={false} oncancel={() => handle.close()} onsubmit={submit} />
</Detail>
