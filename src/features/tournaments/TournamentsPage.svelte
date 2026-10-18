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
  import Icon from '../../ui/Icon.svelte';
  import Page from '../../ui/Page.svelte';
  import Tag from '../../ui/Tag.svelte';
  import { TOURNAMENT_CHANGED } from './events';
  import { STATUS_LABELS, STATUS_TONES } from './model';
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
</script>

<Page title="Turniere">
  {#snippet actions()}
    {#if policy.canManage()}<Button variant="primary" icon="add" onclick={create}>Neues Turnier</Button>{/if}
  {/snippet}

  <AsyncView resource={list}>
    {#snippet children(all)}
      {@const items = all.filter((t) => !pendingDeletes.isHidden(t.id))}
      {#if items.length}
        <ul class="cards">
          {#each items as t (t.id)}
            <li>
              <a href="#/tournaments/{t.id}">
                <span class="icon"><Icon name="trophy" /></span>
                <span class="name">{t.name}</span>
                <span class="muted">{days(t.startsOn, t.endsOn)} · {t.teams} Teams</span>
                <Tag tone={STATUS_TONES[t.status]}>{STATUS_LABELS[t.status]}</Tag>
              </a>
            </li>
          {/each}
        </ul>
      {:else}
        <Empty text="Noch kein Turnier geplant." action={policy.canManage() ? { label: 'Neues Turnier', icon: 'add', run: create } : null} />
      {/if}
    {/snippet}
  </AsyncView>
</Page>

<style>
  .cards {
    display: grid;
    gap: var(--space-sm);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .cards a {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-md) var(--space-lg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    color: inherit;
    text-decoration: none;
    transition: border-color var(--motion-fast) var(--motion-easing), background var(--motion-fast) var(--motion-easing);
  }
  .cards a:hover {
    border-color: var(--color-border-strong);
    background: var(--color-hover);
  }
  .icon {
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border-radius: var(--radius-md);
    background: var(--color-accent-soft);
    color: var(--color-accent);
  }
  .name {
    overflow: hidden;
    font-weight: var(--font-weight-medium);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  :global(:root[data-layout='compact']) .cards a {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }
  :global(:root[data-layout='compact']) .cards .muted {
    display: none;
  }
</style>
