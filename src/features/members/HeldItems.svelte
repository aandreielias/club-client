<script lang="ts">
  import { permissions } from '../../lib/container';
  import { Resource } from '../../lib/state/Resource.svelte';
  import RecordLink from '../../ui/RecordLink.svelte';
  import { inventoryApi } from '../inventory/services';

  /** Club items the member has right now (stock held by this person); hidden when there are none. */
  let { memberId }: { memberId: string } = $props();

  // svelte-ignore state_referenced_locally
  const held = new Resource(() => inventoryApi.heldBy(memberId));
  void held.load();
</script>

{#if held.value?.length}
  <h2>Hat gerade</h2>
  <ul class="held">
    {#each held.value as item (item.itemId)}
      <li>
        <RecordLink kind="item" id={item.itemId} allowed={permissions.isPrivileged}>{item.name}</RecordLink>
        <span class="count">{item.quantity}</span>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .held {
    display: grid;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .held li {
    display: flex;
    justify-content: space-between;
    gap: var(--space-md);
    min-height: var(--control-height);
    align-items: center;
    border-bottom: 1px solid var(--color-border);
  }
  .count {
    font-variant-numeric: tabular-nums;
  }
</style>
