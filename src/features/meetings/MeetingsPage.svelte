<script lang="ts">
  import { bus, commands, router, session, store, windows } from '../../lib/container';
  import { WINDOW_OPEN } from '../../channels';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import { windowMenu } from '../../lib/window/windowMenu';
  import Button from '../../ui/Button.svelte';
  import DataTable from '../../ui/DataTable.svelte';
  import Page from '../../ui/Page.svelte';
  import Tag from '../../ui/Tag.svelte';
  import { MEETING_CHANGED } from './events';
  import { MeetingListModel } from './MeetingListModel.svelte';
  import { STATUS_LABELS, STATUS_TONES } from './model';
  import { meetingPolicy as policy, meetingsApi, meetingTypes } from './services';

  /** Mitgliederversammlungen and Vorstandssitzungen: the coming ones first; each opens in the window. */
  const list = new MeetingListModel(
    meetingsApi,
    meetingTypes,
    () => session.format,
    () => new Date().toISOString(),
    store,
  );
  void list.load();
  useBus(bus, MEETING_CHANGED, () => void list.load());
  const create = () => bus.publish(WINDOW_OPEN, { kind: 'meeting-new', id: '-' });
  useCommands(commands, { 'page.new': { run: create, when: () => policy.canCreate() } });
</script>

<Page title="Sitzungen">
  {#snippet actions()}
    {#if policy.canCreate()}<Button variant="primary" icon="add" onclick={create}>Neue Sitzung</Button>{/if}
  {/snippet}

  <DataTable
    model={list}
    rowKey={(m) => m.id}
    record={(m) => ({ kind: 'meeting', id: m.id, title: m.title })}
    onopen={(m) => bus.publish(WINDOW_OPEN, { kind: 'meeting', id: m.id })}
    menu={(m) => windowMenu(bus, windows, router, 'meeting', m.id)}
    selected={windows.current?.kind === 'meeting' ? windows.current.id : null}
    emptyText="Keine Sitzungen. Mitgliederversammlungen sehen die stimmberechtigten Mitglieder, Vorstandssitzungen nur der Vorstand."
    emptyAction={policy.canCreate() ? { label: 'Neue Sitzung', icon: 'add', run: create } : null}
  >
    {#snippet cell(m, column)}
      {#if column.key === 'status'}
        <Tag tone={STATUS_TONES[m.status]}>{STATUS_LABELS[m.status]}</Tag>
      {:else}
        {list.display(m, column)}
      {/if}
    {/snippet}
  </DataTable>
</Page>
