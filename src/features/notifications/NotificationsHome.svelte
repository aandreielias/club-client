<script lang="ts">
  import { settings } from '../../settings';
  import { session, store } from '../../lib/container';
  import LinkButton from '../../ui/LinkButton.svelte';
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

<section>
  <h2 class="heading">
    Benachrichtigungen
    {#if center.unread}<span class="muted count">{center.unread} neu</span>{/if}
    <LinkButton href="#/notifications" tooltip="Alle Benachrichtigungen anzeigen">Alle anzeigen</LinkButton>
  </h2>
  <NotificationTable {list} toolbar={false} emptyText="Keine Benachrichtigungen." />
</section>

<style>
  .heading {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }
  .heading :global(a:last-child) {
    margin-left: auto;
  }
  .count {
    font-size: var(--font-size-small);
    font-weight: var(--font-weight-medium);
  }
</style>
