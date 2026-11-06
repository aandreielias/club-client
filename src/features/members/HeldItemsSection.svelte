<script lang="ts">
  import { permissions } from '../../lib/container';
  import { Resource } from '../../lib/state/Resource.svelte';
  import RecordLink from '../../ui/RecordLink.svelte';
  import { inventoryApi } from '../inventory/services';

  /** Club items the member has right now (stock held by this person); hidden when there are none. */
  let { memberId, title = 'Hat gerade', note }: { memberId: string; title?: string; note?: string } = $props();

  // svelte-ignore state_referenced_locally
  const held = new Resource(() => inventoryApi.heldBy(memberId));
  void held.load();
</script>

{#if held.value === undefined && !held.error}
  <span class="skeleton slot" aria-busy="true" aria-label="Laden"></span>
{:else if held.value?.length}
  <h2>{title}</h2>
  <ul class="rows">
    {#each held.value as item (item.itemId)}
      <li>
        <RecordLink kind="item" id={item.itemId} allowed={permissions.isPrivileged}>{item.name}</RecordLink>
        <span class="count">{item.quantity}</span>
      </li>
    {/each}
  </ul>
  {#if note}<p class="muted small">{note}</p>{/if}
{/if}

<style>
  .count {
    font-variant-numeric: tabular-nums;
  }
</style>
