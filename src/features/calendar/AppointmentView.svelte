<script lang="ts">
  import { commands, directory, linksApi, live, permissions, session, toasts } from '../../lib/container';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import { LinksModel } from '../../lib/links/LinksModel.svelte';
  import { onLive } from '../../lib/live/onLive.svelte';
  import { Action } from '../../lib/state/Action.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import Detail from '../../ui/Detail.svelte';
  import LinksSection from '../../ui/LinksSection.svelte';
  import Tag from '../../ui/Tag.svelte';
  import AppointmentEditor from './AppointmentEditor.svelte';
  import { AppointmentDetailModel } from './AppointmentDetailModel.svelte';
  import { AppointmentForm } from './AppointmentForm.svelte';
  import AttendancePanel from './AttendancePanel.svelte';
  import { CalendarApi } from './CalendarApi';
  import CancelDialog from './CancelDialog.svelte';
  import { APPOINTMENTS_CHANGED, RESPONSE_CHANGED, type AppointmentsChanged, type ResponseChanged } from './events';
  import { typeHue, typeLabel, type Appointment } from './model';
  import ResponseForm from './ResponseForm.svelte';
  import { appointmentPolicy as policy, calendarApi } from './services';

  /** One appointment: properties, own answer, attendance; edit and cancel for managers. Window and page. */
  let { id, handle }: { id: string; handle?: WindowHandle } = $props();

  // svelte-ignore state_referenced_locally
  const detail = new AppointmentDetailModel(calendarApi, id, session.member.id);
  const save = new Action();
  let form = $state<AppointmentForm | null>(null);
  let cancelOpen = $state(false);

  // svelte-ignore state_referenced_locally
  const links = new LinksModel(linksApi, `${CalendarApi.APPOINTMENTS}/${encodeURIComponent(id)}`);

  void detail.load();
  void links.load();
  directory.loadRosters();
  if (permissions.isManager) directory.loadTeams().catch(() => {});

  $effect(() => {
    const title = detail.appointment.value?.title;
    if (title) handle?.setTitle(title);
  });

  onLive<AppointmentsChanged>(live, APPOINTMENTS_CHANGED, ({ data }) => {
    if (!data.appointmentIds.includes(detail.id)) return;
    if (!save.busy && !form) void detail.appointment.load();
    if (!links.editing && !links.save.busy) void links.load();
  });
  onLive<ResponseChanged>(live, RESPONSE_CHANGED, ({ data }) => {
    if (data.appointmentId === detail.id && !detail.respondAction.busy) void detail.attendance.load();
  });

  const canAnswer = () => !form && !!detail.appointment.value && !!detail.attendance.value && policy.canRespond(detail.appointment.value);
  async function answer(status: 'YES' | 'MAYBE' | 'NO') {
    if (await detail.respond(status, detail.ownEntry?.reason ?? '')) toasts.show('Antwort gespeichert.');
  }
  useCommands(commands, {
    'appointment.edit': {
      run: () => detail.appointment.value && (form = AppointmentForm.edit(session.clock, detail.appointment.value)),
      when: () => !form && !!detail.appointment.value && policy.canEdit(detail.appointment.value),
    },
    'appointment.yes': { run: () => void answer('YES'), when: canAnswer },
    'appointment.maybe': { run: () => void answer('MAYBE'), when: canAnswer },
    'appointment.no': { run: () => void answer('NO'), when: canAnswer },
  });

  function when(appointment: Appointment): string {
    const { clock, format } = session;
    const day = clock.localDate(appointment.startsAt);
    return day === clock.localDate(appointment.endsAt)
      ? `${format.dayHeading(day)}, ${format.range(appointment.startsAt, appointment.endsAt, true)}`
      : format.range(appointment.startsAt, appointment.endsAt, false);
  }

  function closedReason(appointment: Appointment): string {
    if (appointment.cancelled) return 'Der Termin ist abgesagt.';
    if (policy.isPast(appointment)) return 'Der Termin hat schon begonnen.';
    return 'Nur Mitglieder des Teams können antworten.';
  }

  async function submit(value: AppointmentForm) {
    const original = value.original;
    if (!original) return;
    if (await save.run(() => calendarApi.update(original.id, value.toPatch()))) {
      form = null;
      toasts.show('Termin gespeichert.');
      void detail.appointment.load();
    }
  }
</script>

<AsyncView resource={detail.appointment}>
  {#snippet children(appointment)}
    <Detail title={form ? 'Termin bearbeiten' : appointment.title}>
      {#snippet actions()}
        {#if !form && policy.canEdit(appointment)}
          <Button onclick={() => (form = AppointmentForm.edit(session.clock, appointment))}>Bearbeiten</Button>
          <Button variant="danger" onclick={() => (cancelOpen = true)}>Absagen</Button>
        {/if}
      {/snippet}
      {#snippet meta()}
        {#if !form}
          <Tag tone={typeHue(appointment.type)}>{typeLabel(appointment.type)}</Tag>
          {#if appointment.cancelled}<Tag tone="red">Abgesagt</Tag>{/if}
          {#if appointment.seriesId}<Tag tone="gray">Serie</Tag>{/if}
        {/if}
      {/snippet}

      {#if form}
        <AppointmentEditor {form} action={save} submitLabel="Speichern" oncancel={() => (form = null)} onsubmit={() => form && submit(form)} />
      {:else}
        <dl class="props">
          <dt>Wann</dt>
          <dd>{when(appointment)}</dd>
          <dt>Ort</dt>
          <dd>{appointment.location || '–'}</dd>
          <dt>Für</dt>
          <dd>{appointment.teamId ? (directory.teamName(appointment.teamId) ?? 'Team') : 'Ganzer Verein'}</dd>
        </dl>
        {#if appointment.description}<p class="prose">{appointment.description}</p>{/if}

        <LinksSection model={links} editable={policy.canEdit(appointment)} />

        <h2>Meine Antwort</h2>
        {#if policy.canRespond(appointment)}
          <AsyncView resource={detail.attendance}>
            {#snippet children()}
              <ResponseForm {detail} />
            {/snippet}
          </AsyncView>
        {:else}
          <p class="muted">{closedReason(appointment)}</p>
        {/if}

        <h2>Teilnahme</h2>
        <AsyncView resource={detail.attendance}>
          {#snippet children(attendance)}
            <AttendancePanel {attendance} {detail} />
          {/snippet}
        </AsyncView>

        {#if policy.canEdit(appointment)}
          <CancelDialog bind:open={cancelOpen} {detail} {appointment} oncancelled={() => toasts.show('Termin abgesagt.')} />
        {/if}
      {/if}
    </Detail>
  {/snippet}
</AsyncView>
