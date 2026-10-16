<script lang="ts">
  import { commands, session, store } from '../../lib/container';
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

  useCommands(commands, { 'notifications.readAll': { run: () => void center.markAllRead(), when: () => center.unread > 0 } });

</script>

<Page title="Benachrichtigungen">
  {#snippet actions()}
    <LinkButton href="#/notifications/settings" tooltip="Festlegen, worüber und wie du benachrichtigt wirst">Einstellungen</LinkButton>
    <Button variant="primary" busy={center.markAllAction.busy} disabled={center.unread === 0} onclick={() => center.markAllRead()}>
      Alle als gelesen markieren
    </Button>
  {/snippet}

  <ErrorNote error={center.markAllAction.error} />
  <NotificationTable {list} />
</Page>
