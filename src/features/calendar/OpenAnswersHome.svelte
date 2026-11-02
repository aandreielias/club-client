<script lang="ts">
  import { bus, directory, session } from '../../lib/container';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import { background } from '../../lib/state/background';
  import { Resource } from '../../lib/state/Resource.svelte';
  import { Action } from '../../lib/state/Action.svelte';
  import { WINDOW_OPEN } from '../../channels';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import SectionHeading from '../../ui/SectionHeading.svelte';
  import { tooltip } from '../../ui/tooltip';
  import { APPOINTMENTS_CHANGED, RESPONSE_CHANGED } from './events';
  import { RESPONSE_OPTIONS, type OpenAnswer, type ResponseStatus } from './model';
  import { calendarApi } from './services';

  /** Start page: answers still to give in the next two weeks, for oneself and one's minors, answered right here. */
  const open = new Resource(() => calendarApi.openAnswers());
  void open.load();
  background(directory.loadTeams());
  const answer = new Action();
  let busyKey = $state<string | null>(null);

  useBus(bus, RESPONSE_CHANGED, () => !answer.busy && void open.load());
  useBus(bus, APPOINTMENTS_CHANGED, () => void open.load());

  const key = (o: OpenAnswer) => `${o.appointmentId}:${o.memberId}`;

  async function respond(o: OpenAnswer, status: ResponseStatus) {
    busyKey = key(o);
    const self = o.memberId === session.member.id;
    if (await answer.run(() => calendarApi.respond(o.appointmentId, status, null, self ? null : o.memberId))) await open.load();
    busyKey = null;
  }
</script>

<SectionHeading title="Offene Zusagen" href="#/calendar" />
<AsyncView resource={open}>
  {#snippet children(items)}
    {#if items.length}
      <ul class="answers">
        {#each items as o (key(o))}
          <li>
            <button
              class="link"
              type="button"
              {@attach tooltip('Termin öffnen')}
              onclick={() => bus.publish(WINDOW_OPEN, { kind: 'appointment', id: o.appointmentId })}
            >
              <strong>{o.title}</strong>
              <span class="muted small">
                {session.format.dateTime(o.startsAt)}{o.teamId ? ` · ${directory.teamName(o.teamId) ?? 'Team'}` : ''}{o.memberId !== session.member.id
                  ? ` · für ${o.name}`
                  : ''}
              </span>
            </button>
            <span class="row">
              {#each RESPONSE_OPTIONS as option (option.value)}
                <Button
                  size="sm"
                  variant={option.value === 'YES' ? 'primary' : 'ghost'}
                  busy={busyKey === key(o) && answer.busy}
                  tooltip="{option.label} für „{o.title}“"
                  onclick={() => respond(o, option.value)}>{option.label}</Button
                >
              {/each}
            </span>
          </li>
        {/each}
      </ul>
      <ErrorNote error={answer.error} />
    {:else}
      <p class="muted">Alles beantwortet.</p>
    {/if}
  {/snippet}
</AsyncView>

<style>
  p {
    margin: 0;
  }
  .answers {
    display: grid;
    gap: var(--space-sm);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .answers li {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm);
    align-items: center;
    justify-content: space-between;
  }
  .link {
    display: grid;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: pointer;
  }
</style>
