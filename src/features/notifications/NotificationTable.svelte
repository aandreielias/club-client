<script lang="ts">
  import { bus, links } from '../../lib/container';
  import { NAVIGATE, WINDOW_OPEN } from '../../channels';
  import DataTable from '../../ui/DataTable.svelte';
  import Tag from '../../ui/Tag.svelte';
  import type { Notification } from './model';
  import type { NotificationListModel } from './NotificationListModel.svelte';
  import { notificationCenter as center } from './services';

  /** Notifications as a list: opening marks read and follows the link. Used by the inbox and the start page. */
  let { list, toolbar = true, emptyText = 'Noch keine Benachrichtigungen.' }: { list: NotificationListModel; toolbar?: boolean; emptyText?: string } =
    $props();

  async function open(notification: Notification) {
    await center.markRead(notification);
    const target = links.resolve(notification.link);
    if (!target) return;
    if ('window' in target) bus.publish(WINDOW_OPEN, { kind: target.window.kind, id: target.window.id });
    else bus.publish(NAVIGATE, { path: target.path });
  }
</script>

<DataTable model={list} rowKey={(n) => n.id} onopen={open} {toolbar} {emptyText}
  menu={(n) => [
    { label: 'Öffnen', run: () => void open(n) },
    { label: 'Als gelesen markieren', disabled: n.readAt !== null, run: () => void center.markRead(n) },
  ]}>
  {#snippet cell(notification, column)}
    {#if column.key === 'title'}
      <span class:unread={!notification.readAt}>{notification.title}</span>
      {#if !notification.readAt}<Tag tone="blue">Neu</Tag>{/if}
    {:else if column.key === 'body'}
      <span class="muted">{notification.body}</span>
    {:else}
      {list.display(notification, column)}
    {/if}
  {/snippet}
</DataTable>

<style>
  .unread {
    font-weight: var(--font-weight-bold);
  }
</style>
