<script lang="ts">
  import { bus, directory, pendingDeletes, permissions, session } from '../../lib/container';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import { TOAST } from '../../channels';
  import { settings } from '../../settings';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
  import { RIDES_CHANGED } from './events';
  import type { Ride } from './model';
  import CarSeats from './CarSeats.svelte';
  import { RidesModel } from './RidesModel.svelte';
  import { calendarApi } from './services';

  /** Car pools of an appointment: drivers offer seats, members take one for themselves or their minors. */
  let { appointmentId, open }: { appointmentId: string; open: boolean } = $props();

  const me = session.member.id;
  // svelte-ignore state_referenced_locally
  const model = new RidesModel(calendarApi, appointmentId, me);
  void model.load();
  useBus(bus, RIDES_CHANGED, ({ data }) => {
    if (data.appointmentId === model.appointmentId && !model.action.busy) void model.load();
  });

  const seatOptions = Array.from({ length: settings.calendar.rideMaxSeats }, (_, i) => ({
    value: String(i + 1),
    label: `${i + 1} ${i ? 'Plätze' : 'Platz'}`,
  }));
  let seats = $state('3');
  let note = $state('');

  /** Self and minors who could still get a seat in this car. */
  const riders = (ride: Ride) => [me, ...session.wardIds].filter((id) => id !== ride.driverId && !RidesModel.has(ride, id));
  const mayRemove = (ride: Ride, memberId: string) =>
    memberId === me || ride.driverId === me || permissions.isManager || session.wardIds.includes(memberId);
  const riderLabel = (id: string) => (id === me ? 'Mitfahren' : `${directory.nameOf(id)} mitnehmen`);

  async function offer(event: SubmitEvent) {
    event.preventDefault();
    if (await model.offer(Number(seats), note)) {
      note = '';
      bus.publish(TOAST, { text: 'Fahrt angeboten.' });
    }
  }

  function cancel(ride: Ride) {
    pendingDeletes.schedule({ ids: [ride.id], text: 'Fahrt abgesagt.', commit: () => model.cancel(ride.id) });
  }
</script>

<AsyncView resource={model.rides}>
  {#snippet children(rides)}
    {@const shown = rides.filter((r) => !pendingDeletes.isHidden(r.id))}
    {#if !shown.length}
      <p class="muted">Noch keine Fahrgemeinschaft. {open ? 'Wer fährt, kann hier Plätze anbieten.' : ''}</p>
    {/if}
    <ul class="rides">
      {#each shown as ride (ride.id)}
        {@const free = RidesModel.free(ride)}
        <li>
          <div class="ride">
            <div class="head">
              <strong>{ride.driverName}</strong>
              <span class="muted">{free ? `${free} von ${ride.seats} frei` : 'voll'}</span>
              {#if open && (ride.driverId === me || permissions.isManager)}
                <Button size="sm" variant="ghost" onclick={() => cancel(ride)}>Fahrt absagen</Button>
              {/if}
            </div>
            {#if ride.note}<p class="muted note">{ride.note}</p>{/if}
            {#if ride.passengers.length}
              <ul class="passengers">
                {#each ride.passengers as p (p.memberId)}
                  <li>
                    {p.name}
                    {#if open && mayRemove(ride, p.memberId)}
                      <Button
                        size="sm"
                        variant="ghost"
                        icon="close"
                        tooltip="{p.name} aussteigen lassen"
                        onclick={() => model.leave(ride.id, p.memberId)}
                      />
                    {/if}
                  </li>
                {/each}
              </ul>
            {/if}
            {#if open && free}
              <div class="row">
                {#each riders(ride) as id (id)}
                  <Button
                    size="sm"
                    tooltip="Einen Platz in diesem Auto nehmen"
                    busy={model.action.busy}
                    onclick={() => model.join(ride.id, id === me ? null : id)}>{riderLabel(id)}</Button
                  >
                {/each}
              </div>
            {/if}
          </div>
          <CarSeats {ride} />
        </li>
      {/each}
    </ul>
    <ErrorNote error={model.action.error} />
    {#if open && !model.driving}
      <form class="offer" onsubmit={offer}>
        <Field label="Ich fahre und habe"><Select bind:value={seats} options={seatOptions} /></Field>
        <Field label="Hinweis (optional)">
          <input bind:value={note} maxlength={settings.calendar.rideNoteMaxLength} placeholder="z. B. Abfahrt 17:30 bei der Halle" />
        </Field>
        <div><Button type="submit" busy={model.action.busy}>Fahrt anbieten</Button></div>
      </form>
    {/if}
  {/snippet}
</AsyncView>

<style>
  .rides,
  .passengers {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .rides {
    display: grid;
    gap: var(--space-sm);
    margin-bottom: var(--space-md);
  }
  .rides > li {
    display: flex;
    align-items: flex-start;
    gap: var(--space-md);
    padding: var(--space-sm) var(--space-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }
  .ride {
    flex: 1;
    min-width: 0;
  }
  .head {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }
  .head :global(button) {
    margin-left: auto;
  }
  .note {
    margin: var(--space-xs) 0 0;
  }
  .passengers {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs) var(--space-md);
    margin-top: var(--space-xs);
  }
  .passengers li {
    display: flex;
    align-items: center;
  }
  .row {
    margin-top: var(--space-sm);
  }
  .offer {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: var(--space-sm);
    align-items: end;
  }
  @media (max-width: 560px) {
    .offer {
      grid-template-columns: 1fr;
    }
  }
</style>
