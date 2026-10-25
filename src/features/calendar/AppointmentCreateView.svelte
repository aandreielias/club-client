<script lang="ts">
  import { bus, directory, permissions, session } from '../../lib/container';
  import { CreateController } from '../../lib/detail/CreateController.svelte';
  import { Resource } from '../../lib/state/Resource.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Detail from '../../ui/Detail.svelte';
  import AppointmentEditor from './AppointmentEditor.svelte';
  import { AppointmentForm } from './AppointmentForm.svelte';
  import { appointmentPolicy as policy, calendarApi, appointmentTypes } from './services';

  /** New appointment in the window. `id` carries presets as a query string: `team=<id>&date=<YYYY-MM-DD>`. */
  let { id, handle }: { id: string; handle: WindowHandle } = $props();

  // svelte-ignore state_referenced_locally
  const create = new CreateController(bus, handle, 'Neuer Termin');

  // svelte-ignore state_referenced_locally
  const presets = new URLSearchParams(id === '-' ? '' : id);

  const form = new Resource<AppointmentForm>(async () => {
    if (permissions.isManager) await directory.loadTeams().catch(() => {});
    await directory.loadRosters();
    const date = presets.get('date');
    return AppointmentForm.blank(session.clock, defaultTeam(), date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined, appointmentTypes);
  });
  void form.load();

  function defaultTeam(): string | null {
    const requested = presets.get('team');
    const teams = policy.plannableTeams();
    if (requested && teams.some((t) => t.id === requested)) return requested;
    return policy.canCreateClubWide() ? null : (teams[0]?.id ?? null);
  }

  // A series answers with every occurrence; the window shows the first.
  const submit = (value: AppointmentForm) => create.submit(async () => (await calendarApi.create(value.toNew()))[0].id, 'appointment', 'Termin angelegt.');
</script>

<AsyncView resource={form}>
  {#snippet children(value)}
    <Detail title="Neuer Termin">
      <AppointmentEditor form={value} action={create.save} submitLabel="Anlegen" oncancel={() => handle.close()} onsubmit={() => submit(value)} />
    </Detail>
  {/snippet}
</AsyncView>
