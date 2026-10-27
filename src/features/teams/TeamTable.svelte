<script lang="ts">
  import { bus, router, session, windows } from '../../lib/container';
  import { WINDOW_OPEN } from '../../channels';
  import { windowMenu } from '../../lib/window/windowMenu';
  import DataTable from '../../ui/DataTable.svelte';
  import type { EmptyAction } from '../../ui/Empty.svelte';
  import Tag from '../../ui/Tag.svelte';
  import type { TeamListModel } from '../../lib/directory/TeamListModel.svelte';

  /** Teams as rows (teams page, start page); the member's own teams are marked. */
  let {
    list,
    toolbar = true,
    limit,
    emptyAction,
  }: { list: TeamListModel; toolbar?: boolean; limit?: number; emptyAction?: EmptyAction | null } = $props();
</script>

<DataTable
  model={list}
  {toolbar}
  {limit}
  {emptyAction}
  rowKey={(t) => t.id}
  record={(t) => ({ kind: 'team', id: t.id, title: t.name })}
  onopen={(t) => bus.publish(WINDOW_OPEN, { kind: 'team', id: t.id })}
  menu={(t) => windowMenu(bus, windows, router, 'team', t.id)}
  emptyText="Du bist noch in keinem Team."
>
  {#snippet cell(team, column)}
    {#if column.key === 'mine'}
      {#if session.isInTeam(team.id)}<Tag tone="blue">Mein Team</Tag>{/if}
    {:else}
      {list.display(team, column)}
    {/if}
  {/snippet}
</DataTable>
