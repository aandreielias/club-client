<script lang="ts">
  import { bus } from '../../lib/container';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import type { Resource } from '../../lib/state/Resource.svelte';
  import { MEETING_CHANGED, RESOLUTION_CHANGED } from './events';
  import type { Meeting, Resolution } from './model';
  import ResolutionCard from './ResolutionCard.svelte';

  /**
   * The Tagesordnung of a meeting: every item in order, a Beschluss with its card right under it (vote, result, its task once passed).
   * Beschlüsse that are on no item (older meetings) follow at the end.
   */
  let { meeting, resolutions }: { meeting: Meeting; resolutions: Resource<Resolution[]> } = $props();

  useBus(bus, RESOLUTION_CHANGED, ({ data }) => data.meetingId === meeting.id && void resolutions.load());
  // Presence decides who may vote: a latecomer gets the vote buttons without reloading.
  useBus(bus, MEETING_CHANGED, ({ data }) => data.meetingId === meeting.id && void resolutions.load());

  const byId = $derived(new Map((resolutions.value ?? []).map((r) => [r.id, r])));
  const unlisted = $derived((resolutions.value ?? []).filter((r) => !meeting.agendaItems.some((i) => i.resolutionId === r.id)));

  const replace = (updated: Resolution) => resolutions.set((resolutions.value ?? []).map((r) => (r.id === updated.id ? updated : r)));
</script>

{#if meeting.agendaItems.length || unlisted.length}
  <ol class="agenda">
    {#each meeting.agendaItems as item, i (item.id)}
      {@const r = item.resolutionId ? byId.get(item.resolutionId) : undefined}
      <li class="stack">
        <div class="head">
          <span class="number">{i + 1}.</span>
          <span class="title">{item.title}</span>
          {#if item.resolutionId}<span class="muted small">Beschluss</span>{/if}
        </div>
        {#if item.note}<p class="muted small note">{item.note}</p>{/if}
        {#if r}
          <div class="card">
            <ResolutionCard resolution={r} meetingOpen={meeting.status === 'OPEN'} onchanged={replace} ondeleted={() => void resolutions.load()} />
          </div>
        {/if}
      </li>
    {/each}
  </ol>
  {#if unlisted.length}
    <h3>Weitere Beschlüsse</h3>
    <div class="stack">
      {#each unlisted as r (r.id)}
        <ResolutionCard resolution={r} meetingOpen={meeting.status === 'OPEN'} onchanged={replace} ondeleted={() => void resolutions.load()} />
      {/each}
    </div>
  {/if}
{:else if meeting.agenda}
  <p class="text">{meeting.agenda}</p>
{:else}
  <p class="muted">Keine Tagesordnung eingetragen.</p>
{/if}

<style>
  .agenda {
    display: grid;
    gap: var(--space-md);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .head {
    display: flex;
    align-items: baseline;
    gap: var(--space-sm);
  }
  .number {
    width: 1.6rem;
    color: var(--color-text-muted);
  }
  .title {
    font-weight: 600;
  }
  .note,
  .card {
    margin: 0;
    padding-left: 1.6rem;
  }
  .text {
    white-space: pre-line;
  }
  h3 {
    margin: var(--space-md) 0 var(--space-xs);
    font-size: var(--font-size-base);
  }
</style>
