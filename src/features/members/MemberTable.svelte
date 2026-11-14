<script lang="ts">
  import { bus, router, windows } from '../../lib/container';
  import { WINDOW_OPEN } from '../../channels';
  import { windowMenu } from '../../lib/window/windowMenu';
  import { ROLE_LABELS, roleHue } from '../../lib/types';
  import DataTable from '../../ui/DataTable.svelte';
  import type { EmptyAction } from '../../ui/Empty.svelte';
  import Tag from '../../ui/Tag.svelte';
  import type { MemberListModel, MemberRow } from './MemberListModel.svelte';

  /** Members as rows (members page, start page): roles and status as tags, opens in the window (name-only rows stay plain). */
  let {
    list,
    toolbar = true,
    limit,
    emptyAction,
    check,
  }: {
    list: MemberListModel;
    toolbar?: boolean;
    limit?: number;
    emptyAction?: EmptyAction | null;
    /** Selecting rows (bulk actions): a click toggles instead of opening. */
    check?: {
      checked: (m: MemberRow) => boolean;
      toggle: (m: MemberRow) => void;
      disabled?: (m: MemberRow) => boolean;
      label: (m: MemberRow) => string;
    };
  } = $props();
</script>

<DataTable
  model={list}
  {toolbar}
  {limit}
  {emptyAction}
  rowKey={(m) => m.id}
  record={(m) => (m.nameOnly ? null : { kind: 'member', id: m.id, title: `${m.firstName} ${m.lastName}` })}
  {check}
  onopen={check ? undefined : (m) => !m.nameOnly && bus.publish(WINDOW_OPEN, { kind: 'member', id: m.id })}
  menu={(m) => (m.nameOnly ? [] : windowMenu(bus, windows, router, 'member', m.id))}
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
      <span class="muted">{member.nameOnly ? '' : (member.email ?? 'ohne Login')}</span>
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
