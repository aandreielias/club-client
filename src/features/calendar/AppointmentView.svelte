<script lang="ts">
  import { backStack, bus, commands, directory, linksApi, permissions, session } from '../../lib/container';
  import { DetailController, EditSession } from '../../lib/detail/DetailController.svelte';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import { LinksModel } from '../../lib/links/LinksModel.svelte';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import ActivitySection from '../../ui/ActivitySection.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import Detail from '../../ui/Detail.svelte';
  import LinksSection from '../../ui/LinksSection.svelte';
  import LocationMap from '../../ui/LocationMap.svelte';
  import MapButtons from '../../ui/MapButtons.svelte';
  import RecordLink from '../../ui/RecordLink.svelte';
  import Tag from '../../ui/Tag.svelte';
  import type { Location } from '../locations/model';
  import { locationsApi } from '../locations/services';
  import AppointmentEditor from './AppointmentEditor.svelte';
  import { AppointmentDetailModel } from './AppointmentDetailModel.svelte';
  import { AppointmentForm } from './AppointmentForm.svelte';
  import AttendancePanel from './AttendancePanel.svelte';
  import { CalendarApi } from './CalendarApi';
  import CancelDialog from './CancelDialog.svelte';
  import { APPOINTMENTS_CHANGED, RESPONSE_CHANGED } from './events';
  import { typeHue, typeLabel, type Appointment } from './model';
  import ResponseForm from './ResponseForm.svelte';
  import RidesPanel from './RidesPanel.svelte';
  import { appointmentPolicy as policy, calendarApi } from './services';

  /** One appointment: properties, own answer, attendance; edit and cancel for managers. Window and page. */
  let { id, handle }: { id: string; handle?: WindowHandle } = $props();

  // svelte-ignore state_referenced_locally
  const detail = new AppointmentDetailModel(calendarApi, id, session.member.id);

  /** The linked place, for its address and map pin; free-text locations have none. */
  let place = $state<Location | null>(null);
  $effect(() => {
    const locationId = detail.appointment.value?.locationId;
    place = null;
    if (locationId) locationsApi.get(locationId).then((p) => (place = p), () => {});
  });
  // svelte-ignore state_referenced_locally
  const view = new DetailController(bus, handle);
  const edit = new EditSession<AppointmentForm>(bus, backStack);
  let cancelOpen = $state(false);

  // svelte-ignore state_referenced_locally
  const links = new LinksModel(linksApi, `${CalendarApi.APPOINTMENTS}/${encodeURIComponent(id)}`);

  void detail.load();
  void links.load();
  directory.loadRosters();
  if (permissions.isManager) directory.loadTeams().catch(() => {});

  view.title(() => detail.appointment.value?.title);

  useBus(bus, APPOINTMENTS_CHANGED, ({ data }) => {
    if (!data.appointmentIds.includes(detail.id)) return;
    if (!edit.save.busy && !edit.editing) void detail.appointment.load();
    if (!links.editing && !links.save.busy) void links.load();
  });
  useBus(bus, RESPONSE_CHANGED, ({ data }) => {
    if (data.appointmentId === detail.id && !detail.respondAction.busy) void detail.attendance.load();
  });

  const canAnswer = () => !edit.editing && !!detail.appointment.value && !!detail.attendance.value && policy.canRespond(detail.appointment.value);
  async function answer(status: 'YES' | 'MAYBE' | 'NO') {
    if (await detail.respond(status, detail.ownEntry?.reason ?? '')) view.notify('Antwort gespeichert.');
  }
  useCommands(commands, {
    'appointment.edit': {
      run: () => detail.appointment.value && edit.edit(AppointmentForm.edit(session.clock, detail.appointment.value)),
      when: () => !edit.editing && !!detail.appointment.value && policy.canEdit(detail.appointment.value),
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

  async function submit() {
    const original = edit.form?.original;
    if (original && (await edit.submit((form) => calendarApi.update(original.id, form.toPatch()), 'Termin gespeichert.'))) void detail.appointment.load();
  }
</script>

<AsyncView resource={detail.appointment}>
  {#snippet children(appointment)}
    <Detail title={edit.form ? 'Termin bearbeiten' : appointment.title}>
      {#snippet actions()}
        {#if !edit.form && policy.canEdit(appointment)}
          <Button icon="edit" onclick={() => edit.edit(AppointmentForm.edit(session.clock, appointment))}>Bearbeiten</Button>
          <Button variant="danger" onclick={() => (cancelOpen = true)}>Absagen</Button>
        {/if}
      {/snippet}
      {#snippet meta()}
        {#if !edit.form}
          <Tag tone={typeHue(appointment.type)}>{typeLabel(appointment.type)}</Tag>
          {#if appointment.cancelled}<Tag tone="red">Abgesagt</Tag>{/if}
          {#if appointment.seriesId}<Tag tone="gray">Serie</Tag>{/if}
        {/if}
      {/snippet}

      {#if edit.form}
        <div class="editing" {@attach edit.track}>
          <AppointmentEditor form={edit.form} action={edit.save} submitLabel="Speichern" oncancel={() => edit.cancel()} onsubmit={submit} />
        </div>
      {:else}
        <!-- Facts left, the small map right (below on phones) when the place has a map pin. -->
        <div class="top" class:with-map={place?.lat != null}>
          <dl class="props">
            <dt>Wann</dt>
            <dd>{when(appointment)}</dd>
            <dt>Ort</dt>
            <dd class="place">
              {#if appointment.locationId}
                <RecordLink kind="location" id={appointment.locationId}>{appointment.location}</RecordLink>
              {:else}
                {appointment.location || '–'}
              {/if}
              {#if place?.address}<span class="muted">{place.address}</span>{/if}
              {#if appointment.location}
                <MapButtons place={place ?? { name: appointment.location, address: null, lat: null, lng: null }} />
              {/if}
            </dd>
            {#if appointment.cabinMen || appointment.cabinWomen}
              <dt>Kabinen</dt>
              <dd>
                {[appointment.cabinMen && `Herren: ${appointment.cabinMen}`, appointment.cabinWomen && `Damen: ${appointment.cabinWomen}`]
                  .filter(Boolean).join(' · ')}
              </dd>
            {/if}
            <dt>Für</dt>
            <dd>{appointment.teamId ? (directory.teamName(appointment.teamId) ?? 'Team') : 'Ganzer Verein'}</dd>
          </dl>
          {#if place && place.lat !== null && place.lng !== null}<LocationMap lat={place.lat} lng={place.lng} name={place.name} />{/if}
        </div>
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

        {#if policy.hasRides(appointment)}
          <h2>Fahrgemeinschaft</h2>
          <RidesPanel appointmentId={appointment.id} open={!policy.isPast(appointment)} />
        {/if}

        <ActivitySection kind="APPOINTMENT" id={appointment.id} />

        {#if policy.canEdit(appointment)}
          <CancelDialog bind:open={cancelOpen} {detail} {appointment} oncancelled={() => view.notify('Termin abgesagt.')} />
        {/if}
      {/if}
    </Detail>
  {/snippet}
</AsyncView>

<style>
  .editing {
    display: contents;
  }
  .top {
    display: grid;
    gap: var(--space-lg);
  }
  .top.with-map {
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
    align-items: start;
  }
  :global(:root[data-layout='compact']) .top.with-map {
    grid-template-columns: minmax(0, 1fr);
  }
  .place {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-xxs);
  }
</style>
