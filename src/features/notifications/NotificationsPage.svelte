<script lang="ts">
  import { bus, commands, permissions, session, store } from '../../lib/container';
  import { WINDOW_OPEN } from '../../channels';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import LinkButton from '../../ui/LinkButton.svelte';
  import Page from '../../ui/Page.svelte';
  import NotificationTable from './NotificationTable.svelte';
  import { NotificationListModel } from './NotificationListModel.svelte';
  import { notificationCenter as center } from './services';

  const list = new NotificationListModel(center, () => session.format, store);
  void list.load();

  // The center changes on mark-read and live arrivals; the list shows the same data.
  $effect(() => {
    const items = center.inbox.value?.items;
    if (items) list.set(items);
  });

  const compose = () => bus.publish(WINDOW_OPEN, { kind: 'message-new', id: '-' });

  useCommands(commands, {
    'notifications.readAll': { run: () => void center.markAllRead(), when: () => center.unread > 0 },
    'page.new': { run: compose, when: () => permissions.isPrivileged },
  });

</script>

<Page title="Benachrichtigungen">
  {#snippet actions()}
    <LinkButton href="#/notifications/settings" tooltip="Festlegen, worüber und wie du benachrichtigt wirst">Einstellungen</LinkButton>
    <Button busy={center.markAllAction.busy} disabled={center.unread === 0} onclick={() => center.markAllRead()}>
      Alle als gelesen markieren
    </Button>
    {#if permissions.isPrivileged}<Button variant="primary" icon="send" onclick={compose}>Nachricht senden</Button>{/if}
  {/snippet}

  <ErrorNote error={center.markAllAction.error} />
  <NotificationTable {list} />
</Page>
