<script lang="ts">
  import { commands, links, router, session, store, windows } from '../../lib/container';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import Button from '../../ui/Button.svelte';
  import DataTable from '../../ui/DataTable.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import LinkButton from '../../ui/LinkButton.svelte';
  import Page from '../../ui/Page.svelte';
  import Tag from '../../ui/Tag.svelte';
  import type { Notification } from './model';
  import { NotificationListModel } from './NotificationListModel.svelte';
  import { notificationCenter as center } from './services';

  const list = new NotificationListModel(center, () => session.format, store);
  void list.load();

  // The center changes on mark-read and live arrivals; the list shows the same data.
  $effect(() => {
    const items = center.inbox.value?.items;
    if (items) list.set(items);
  });

  useCommands(commands, { 'notifications.readAll': { run: () => void center.markAllRead(), when: () => center.unread > 0 } });

  async function open(notification: Notification) {
    await center.markRead(notification);
    const target = links.resolve(notification.link);
    if (!target) return;
    if ('window' in target) windows.open(target.window.kind, target.window.id);
    else router.navigate(target.path);
  }
</script>

<Page title="Benachrichtigungen">
  {#snippet actions()}
    <LinkButton href="#/notifications/settings">Einstellungen</LinkButton>
    <Button variant="primary" busy={center.markAllAction.busy} disabled={center.unread === 0} onclick={() => center.markAllRead()}>
      Alle als gelesen markieren
    </Button>
  {/snippet}

  <ErrorNote error={center.markAllAction.error} />
  <DataTable model={list} rowKey={(n) => n.id} onopen={open}
    menu={(n) => [
      { label: 'Öffnen', run: () => void open(n) },
      { label: 'Als gelesen markieren', disabled: n.readAt !== null, run: () => void center.markRead(n) },
    ]} emptyText="Noch keine Benachrichtigungen.">
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
</Page>

<style>
  .unread {
    font-weight: var(--font-weight-bold);
  }
</style>
