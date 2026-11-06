<script lang="ts">
  import { bus, commands, router, session, store, windows } from '../../lib/container';
  import { WINDOW_OPEN } from '../../channels';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import { usePane } from '../../lib/split/usePane';
  import { windowMenu } from '../../lib/window/windowMenu';
  import Button from '../../ui/Button.svelte';
  import DataTable from '../../ui/DataTable.svelte';
  import Page from '../../ui/Page.svelte';
  import Tag from '../../ui/Tag.svelte';
  import { TOURNAMENT_CHANGED } from './events';
  import { STATUS_LABELS, STATUS_TONES } from './model';
  import { tournamentPolicy as policy, tournamentsApi } from './services';
  import { TournamentListModel } from './TournamentListModel.svelte';

  /** Tournaments the club hosts, the coming ones first; guests see only theirs (and land there directly). */
  const pane = usePane();
  const list = new TournamentListModel(
    tournamentsApi,
    () => session.format,
    () => session.clock.today(),
    store,
  );
  void list.load().then(() => {
    // A guest has exactly one tournament: show it right away.
    const items = list.data.value ?? [];
    if (!policy.canManage() && session.member.roles.includes('GUEST') && items.length === 1) pane.navigate(`/tournaments/${items[0].id}`, true);
  });
  useBus(bus, TOURNAMENT_CHANGED, () => void list.load());
  const create = () => bus.publish(WINDOW_OPEN, { kind: 'tournament-new', id: '-' });
  useCommands(commands, { 'page.new': { run: create, when: () => policy.canManage() } });
</script>

<Page title="Turniere">
  {#snippet actions()}
    {#if policy.canManage()}<Button variant="primary" icon="add" onclick={create}>Neues Turnier</Button>{/if}
  {/snippet}

  <DataTable
    model={list}
    rowKey={(t) => t.id}
    record={(t) => ({ kind: 'tournament', id: t.id, title: t.name })}
    onopen={(t) => bus.publish(WINDOW_OPEN, { kind: 'tournament', id: t.id })}
    menu={(t) => windowMenu(bus, windows, router, 'tournament', t.id)}
    selected={windows.current?.kind === 'tournament' ? windows.current.id : null}
    emptyText="Keine Turniere."
    emptyAction={policy.canManage() ? { label: 'Neues Turnier', icon: 'add', run: create } : null}
  >
    {#snippet cell(t, column)}
      {#if column.key === 'status'}
        <Tag tone={STATUS_TONES[t.status]}>{STATUS_LABELS[t.status]}</Tag>
      {:else}
        {list.display(t, column)}
      {/if}
    {/snippet}
  </DataTable>
  {#if list.truncated}<p class="muted small">Ältere Turniere sind hier nicht aufgelistet.</p>{/if}
</Page>
