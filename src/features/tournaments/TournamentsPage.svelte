<script lang="ts">
  import { bus, commands, pendingDeletes, session } from '../../lib/container';
  import { WINDOW_OPEN } from '../../channels';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import { usePane } from '../../lib/split/usePane';
  import { Resource } from '../../lib/state/Resource.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import Empty from '../../ui/Empty.svelte';
  import Page from '../../ui/Page.svelte';
  import RecordCards, { type RecordCard } from '../../ui/RecordCards.svelte';
  import { TOURNAMENT_CHANGED } from './events';
  import { STATUS_LABELS, STATUS_TONES, type TournamentSummary } from './model';
  import { tournamentPolicy as policy, tournamentsApi } from './services';

  /** Tournaments the club hosts, newest first; guests see only theirs (and land there directly). */
  const pane = usePane();
  const list = new Resource(() => tournamentsApi.list());
  void list.load().then(() => {
    // A guest has exactly one tournament: show it right away.
    if (!policy.canManage() && session.member.roles.includes('GUEST') && list.value?.length === 1) pane.navigate(`/tournaments/${list.value[0].id}`, true);
  });
  useBus(bus, TOURNAMENT_CHANGED, () => void list.load());
  const create = () => bus.publish(WINDOW_OPEN, { kind: 'tournament-new', id: '-' });
  useCommands(commands, { 'page.new': { run: create, when: () => policy.canManage() } });

  const days = (from: string, to: string) =>
    from === to ? session.format.date(from) : `${session.format.date(from)} – ${session.format.date(to)}`;
  const card = (t: TournamentSummary): RecordCard => ({
    href: `#/tournaments/${t.id}`, record: { kind: 'tournament', id: t.id, title: t.name }, icon: 'trophy',
    meta: `${days(t.startsOn, t.endsOn)} · ${t.teams} Teams`, tag: { tone: STATUS_TONES[t.status], label: STATUS_LABELS[t.status] },
  });
</script>

<Page title="Turniere">
  {#snippet actions()}
    {#if policy.canManage()}<Button variant="primary" icon="add" onclick={create}>Neues Turnier</Button>{/if}
  {/snippet}

  <AsyncView resource={list}>
    {#snippet children(all)}
      {@const items = all.filter((t) => !pendingDeletes.isHidden(t.id))}
      {#if items.length}
        <RecordCards cards={items.map(card)} />
      {:else}
        <Empty text="Noch kein Turnier geplant." action={policy.canManage() ? { label: 'Neues Turnier', icon: 'add', run: create } : null} />
      {/if}
    {/snippet}
  </AsyncView>
</Page>
