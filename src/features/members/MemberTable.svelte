<script lang="ts">
  import { bus, router, windows } from '../../lib/container';
  import { WINDOW_OPEN } from '../../channels';
  import { windowMenu } from '../../lib/window/windowMenu';
  import { ROLE_LABELS } from '../../lib/types';
  import DataTable from '../../ui/DataTable.svelte';
  import type { EmptyAction } from '../../ui/Empty.svelte';
  import Tag from '../../ui/Tag.svelte';
  import type { MemberListModel } from './MemberListModel.svelte';
  import { roleHue } from './roles';

  /** Members as rows (members page, start page): roles and status as tags, opens in the window. */
  let {
    list,
    toolbar = true,
    limit,
    emptyAction,
  }: { list: MemberListModel; toolbar?: boolean; limit?: number; emptyAction?: EmptyAction | null } = $props();
</script>

<DataTable
  model={list}
  {toolbar}
  {limit}
  {emptyAction}
  rowKey={(m) => m.id}
  record={(m) => ({ kind: 'member', id: m.id, title: `${m.firstName} ${m.lastName}` })}
  onopen={(m) => bus.publish(WINDOW_OPEN, { kind: 'member', id: m.id })}
  menu={(m) => windowMenu(bus, windows, router, 'member', m.id)}
  selected={windows.current?.kind === 'member' ? windows.current.id : null}
  emptyText="Noch keine Mitglieder."
>
  {#snippet cell(member, column)}
    {#if column.key === 'roles'}
      <span class="tags"
        >{#each member.roles as role (role)}<Tag tone={roleHue(role)}>{ROLE_LABELS[role]}</Tag>{/each}</span
      >
    {:else if column.key === 'status'}
      <Tag tone={member.active ? 'green' : 'red'}>{member.active ? 'Aktiv' : 'Inaktiv'}</Tag>
    {:else if column.key === 'email'}
      <span class="muted">{member.email}</span>
    {:else}
      {list.display(member, column)}
    {/if}
  {/snippet}
</DataTable>

<style>
  .tags {
    display: inline-flex;
    flex-wrap: wrap;
    gap: var(--space-xs);
  }
</style>
