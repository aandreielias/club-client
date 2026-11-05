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
  import { RESOLUTION_CHANGED } from './events';
  import { RESULT_TONES } from './model';
  import { ResolutionListModel, resolutionState } from './ResolutionListModel.svelte';
  import { meetingPolicy as policy, meetingsApi } from './services';

  /** Every Beschluss the member may see, from meetings and circular votes; each opens in the window. */
  const list = new ResolutionListModel(meetingsApi, Number(session.clock.today().slice(0, 4)), store);
  void list.load();
  useBus(bus, RESOLUTION_CHANGED, () => void list.load());
  const create = () => bus.publish(WINDOW_OPEN, { kind: 'resolution-new', id: '-' });
  useCommands(commands, { 'page.new': { run: create, when: () => policy.canCreate() } });
</script>

<Page title="Beschlüsse">
  {#snippet actions()}
    {#if policy.canCreate()}<Button variant="primary" icon="add" onclick={create}>Neuer Umlaufbeschluss</Button>{/if}
  {/snippet}

  <DataTable
    model={list}
    rowKey={(r) => r.id}
    record={(r) => ({ kind: 'resolution', id: r.id, title: r.title })}
    onopen={(r) => bus.publish(WINDOW_OPEN, { kind: 'resolution', id: r.id })}
    menu={(r) => windowMenu(bus, windows, router, 'resolution', r.id)}
    selected={windows.current?.kind === 'resolution' ? windows.current.id : null}
    emptyText="Keine Beschlüsse."
    emptyAction={policy.canCreate() ? { label: 'Neuer Umlaufbeschluss', icon: 'add', run: create } : null}
  >
    {#snippet cell(r, column)}
      {#if column.key === 'state'}
        <Tag tone={r.result ? RESULT_TONES[r.result] : r.status === 'OPEN' ? 'green' : 'gray'}>{resolutionState(r)}</Tag>
      {:else if column.key === 'date'}
        {@const at = r.closedAt ?? r.openedAt}
        {at ? session.format.date(session.clock.localDate(at)) : '–'}
      {/if}
    {/snippet}
  </DataTable>
  {#if list.truncated}<p class="muted small">Es gibt mehr Beschlüsse, als hier stehen. Wähle ein Jahr, um alle eines Jahres zu sehen.</p>{/if}
</Page>
