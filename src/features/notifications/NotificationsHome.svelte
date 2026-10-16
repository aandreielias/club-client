<script lang="ts">
  import { settings } from '../../settings';
  import { session, store } from '../../lib/container';
  import SectionHeading from '../../ui/SectionHeading.svelte';
  import { NotificationListModel } from './NotificationListModel.svelte';
  import NotificationTable from './NotificationTable.svelte';
  import { notificationCenter as center } from './services';

  /** Start page section: the newest notifications, unread ones marked. */
  const list = new NotificationListModel(center, () => session.format, store, 'home-notifications');

  $effect(() => {
    const items = center.inbox.value?.items;
    if (items) list.set([...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, settings.home.notificationCount));
  });
</script>

<SectionHeading title="Benachrichtigungen" href="#/notifications">
  {#snippet note()}{#if center.unread}{center.unread} neu{/if}{/snippet}
</SectionHeading>
<NotificationTable {list} toolbar={false} emptyText="Keine Benachrichtigungen." />
