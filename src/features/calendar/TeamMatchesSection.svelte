<script lang="ts">
  import { bus, session } from '../../lib/container';
  import { WINDOW_OPEN } from '../../channels';
  import { Resource } from '../../lib/state/Resource.svelte';
  import { tooltip } from '../../ui/tooltip';
  import Tag from '../../ui/Tag.svelte';
  import { calendarApi } from './services';

  /** In the team window: the season's matches (the last twelve months) with opponent and result. */
  let { teamId }: { teamId: string } = $props();

  // svelte-ignore state_referenced_locally
  const matches = new Resource(() =>
    calendarApi.teamMatches(teamId, new Date(Date.now() - 365 * 86_400_000).toISOString(), new Date().toISOString()),
  );
  void matches.load();
</script>

{#if matches.value?.items.length}
  {@const list = matches.value}
  <section class="stack">
    <h2>Spiele</h2>
    <p class="muted small">{list.won} gewonnen, {list.lost} verloren in den letzten zwölf Monaten.</p>
    <ul class="rows">
      {#each list.items as m (m.appointmentId)}
        <li>
          <button
            type="button"
            class="link-button row"
            {@attach tooltip('Spiel öffnen')}
            onclick={() => bus.publish(WINDOW_OPEN, { kind: 'appointment', id: m.appointmentId })}
          >
            <span class="muted small">{session.format.date(m.startsAt)}</span>
            <span>{m.home === false ? 'bei' : 'gegen'} {m.opponent ?? m.title}</span>
          </button>
          {#if m.won !== null}<Tag tone={m.won ? 'green' : 'red'}>{m.setsWon}:{m.setsLost}</Tag>{/if}
        </li>
      {/each}
    </ul>
  </section>
{/if}
