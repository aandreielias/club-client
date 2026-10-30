<script lang="ts">
  import { bus } from '../../lib/container';
  import { CreateController } from '../../lib/detail/CreateController.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import Detail from '../../ui/Detail.svelte';
  import OfficeSettingEditor from './OfficeSettingEditor.svelte';
  import { OfficeSettingForm } from './OfficeSettingForm.svelte';
  import { boardSettings, membersApi } from './services';

  /** A function of the club's own (Einstellungen › Funktionen), e.g. Jugendleitung; afterwards the window shows it. */
  let { handle }: { id: string; handle: WindowHandle } = $props();

  const form = new OfficeSettingForm(null);
  // svelte-ignore state_referenced_locally
  const create = new CreateController(bus, handle, 'Neue Funktion');

  const submit = () =>
    create.submit(
      async () => {
        const before = new Set(boardSettings.all);
        const saved = await membersApi.addOffice(form.toNew());
        boardSettings.value = saved;
        return saved.offices.find((o) => !before.has(o.office))?.office ?? saved.offices[saved.offices.length - 1].office;
      },
      'office-setting',
      'Funktion angelegt.',
    );
</script>

<Detail title="Neue Funktion">
  <OfficeSettingEditor {form} action={create.save} submitLabel="Anlegen" oncancel={() => handle.close()} onsubmit={submit} />
</Detail>
