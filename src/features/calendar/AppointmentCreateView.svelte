<script lang="ts">
  import { bus, directory, permissions, session } from '../../lib/container';
  import { TOAST } from '../../channels';
  import { Action } from '../../lib/state/Action.svelte';
  import { Resource } from '../../lib/state/Resource.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Detail from '../../ui/Detail.svelte';
  import AppointmentEditor from './AppointmentEditor.svelte';
  import { AppointmentForm } from './AppointmentForm.svelte';
  import { appointmentPolicy as policy, calendarApi } from './services';

  /** New appointment in the window. `id` carries presets as a query string: `team=<id>&date=<YYYY-MM-DD>`. */
  let { id, handle }: { id: string; handle: WindowHandle } = $props();

  const save = new Action();
  $effect(() => handle.setTitle('Neuer Termin'));

  // svelte-ignore state_referenced_locally
  const presets = new URLSearchParams(id === '-' ? '' : id);

  const form = new Resource<AppointmentForm>(async () => {
    if (permissions.isManager) await directory.loadTeams().catch(() => {});
    await directory.loadRosters();
    const date = presets.get('date');
    return AppointmentForm.blank(session.clock, defaultTeam(), date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined);
  });
  void form.load();

  function defaultTeam(): string | null {
    const requested = presets.get('team');
    const teams = policy.plannableTeams();
    if (requested && teams.some((t) => t.id === requested)) return requested;
    return policy.canCreateClubWide() ? null : (teams[0]?.id ?? null);
  }

  async function submit(value: AppointmentForm) {
    let first = '';
    if (await save.run(async () => (first = (await calendarApi.create(value.toNew()))[0].id))) {
      bus.publish(TOAST, { text: 'Termin angelegt.' });
      handle.open('appointment', first);
    }
  }
</script>

<AsyncView resource={form}>
  {#snippet children(value)}
    <Detail title="Neuer Termin">
      <AppointmentEditor form={value} action={save} submitLabel="Anlegen" oncancel={() => handle.close()} onsubmit={() => submit(value)} />
    </Detail>
  {/snippet}
</AsyncView>
