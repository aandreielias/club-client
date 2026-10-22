<script lang="ts">
  import { bus } from '../../lib/container';
  import { WINDOW_OPEN } from '../../channels';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import { Resource } from '../../lib/state/Resource.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import { RESOLUTION_CHANGED } from './events';
  import type { Resolution } from './model';
  import ResolutionCard from './ResolutionCard.svelte';
  import { meetingsApi } from './services';

  /** Umlaufbeschlüsse of the board (§10 Abs 15), newest first. Admin and board only. */
  const list = new Resource(() => meetingsApi.circular());
  void list.load();
  useBus(bus, RESOLUTION_CHANGED, ({ data }) => data.meetingId === null && void list.load());

  const replace = (updated: Resolution) => list.set((list.value ?? []).map((r) => (r.id === updated.id ? updated : r)));
</script>

<div class="heading">
  <h2>Umlaufbeschlüsse</h2>
  <Button size="sm" icon="add" onclick={() => bus.publish(WINDOW_OPEN, { kind: 'resolution-new', id: '-' })}>Neuer Umlaufbeschluss</Button>
</div>
<AsyncView resource={list}>
  {#snippet children(items)}
    <div class="stack">
      {#each items as r (r.id)}
        <ResolutionCard resolution={r} onchanged={replace} ondeleted={() => void list.load()} />
      {:else}
        <p class="muted">Der Vorstand kann auch schriftlich beschließen: alle bekommen den Antrag und haben mindestens drei Tage Zeit.</p>
      {/each}
    </div>
  {/snippet}
</AsyncView>

<style>
  .heading {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
  }
</style>
