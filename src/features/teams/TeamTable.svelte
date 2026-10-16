<script lang="ts">
  import { bus, router, session, windows } from '../../lib/container';
  import { WINDOW_OPEN } from '../../channels';
  import { windowMenu } from '../../lib/window/windowMenu';
  import DataTable from '../../ui/DataTable.svelte';
  import Tag from '../../ui/Tag.svelte';
  import type { TeamListModel } from './TeamListModel.svelte';

  /** Teams as rows (teams page, start page); the member's own teams are marked. */
  let { list, toolbar = true, limit }: { list: TeamListModel; toolbar?: boolean; limit?: number } = $props();
</script>

<DataTable model={list} {toolbar} {limit} rowKey={(t) => t.id} onopen={(t) => bus.publish(WINDOW_OPEN, { kind: 'team', id: t.id })}
  menu={(t) => windowMenu(bus, windows, router, 'team', t.id)} emptyText="Du bist noch in keinem Team.">
  {#snippet cell(team, column)}
    {#if column.key === 'mine'}
      {#if session.isInTeam(team.id)}<Tag tone="blue">Mein Team</Tag>{/if}
    {:else}
      {list.display(team, column)}
    {/if}
  {/snippet}
</DataTable>
