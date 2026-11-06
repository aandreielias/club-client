<script lang="ts">
  import { bus, permissions } from '../../lib/container';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Page from '../../ui/Page.svelte';
  import RecordLink from '../../ui/RecordLink.svelte';
  import Tag from '../../ui/Tag.svelte';
  import { MEMBERSHIP_CHANGED, TEAMS_CHANGED } from '../teams/events';
  import { MEMBER_DEACTIVATED, MEMBER_INVITED, OFFICES_CHANGED } from './events';
  import { orgLayers, OrgChartModel, type OrgLabels } from './OrgChartModel.svelte';
  import { boardSettings, memberPolicy, membershipKinds, membersApi } from './services';

  /**
   * Organigramm (admin, board, coaches): one layer per role with its number of accounts, deactivated ones greyed. Coaches and players
   * share the team columns, joined by a line. Hovering a card marks the same person in every other layer.
   */
  const model = new OrgChartModel(membersApi);
  void model.load();
  useBus(bus, [OFFICES_CHANGED, MEMBER_INVITED, MEMBER_DEACTIVATED, MEMBERSHIP_CHANGED, TEAMS_CHANGED], () => void model.load());

  const labels: OrgLabels = {
    office: (kind) => boardSettings.label(kind),
    isBoard: (kind) => boardSettings.isBoard(kind),
    kind: (type) => membershipKinds.label(type),
  };
  let marked = $state<string | null>(null);
</script>

{#snippet link(id: string, name: string)}<RecordLink kind="member" {id} allowed={permissions.canSeeMember(id)}>{name}</RecordLink>{/snippet}

<Page title="Organigramm">
  <AsyncView resource={model.data}>
    {#snippet children({ chart, board })}
      {@const layers = orgLayers(chart, board, labels, memberPolicy.isManager)}
      <div class="scroll">
        <div class="layers" style:--teams={Math.max(1, ...layers.map((l) => (l.byTeam ? l.groups.length : 1)))}>
          {#each layers as layer, li (layer.key)}
            <h2 class="label">
              {layer.title}
              <span class="count"
                >{layer.active}{#if layer.inactive}<span class="muted"> · {layer.inactive} deaktiviert</span>{/if}</span
              >
            </h2>
            {#each layer.groups as group (group.key)}
              <div
                class="cell"
                class:wide={!layer.byTeam}
                class:linked={layer.byTeam && layers[li - 1]?.byTeam}
                class:feeds={layer.byTeam && layers[li + 1]?.byTeam}
              >
                {#if group.title}<h3 class="team">
                    {group.title}{#if group.subtitle}<span class="muted"> {group.subtitle}</span>{/if}
                  </h3>{/if}
                <ul class="cards">
                  {#each group.cards as c (c.key)}
                    <li
                      class="card"
                      class:inactive={!c.active}
                      class:marked={marked === c.memberId}
                      onpointerenter={() => (marked = c.memberId)}
                      onpointerleave={() => (marked = null)}
                      onfocusin={() => (marked = c.memberId)}
                      onfocusout={() => (marked = null)}
                    >
                      {#if c.role}<span class="role">{c.role}</span>{/if}
                      <span class="name">{@render link(c.memberId, c.name)}</span>
                      {#each c.relatives as r (r.id)}<span class="relative small">Eltern von {@render link(r.id, r.name)}</span>{/each}
                      {#if c.tags.length || c.also.length}
                        <span class="tags"
                          >{#each c.tags as t, i (i)}<Tag tone={t.tone}>{t.text}</Tag>{/each}{#if c.also.length}<Tag tone="blue"
                              >auch: {c.also.join(', ')}</Tag
                            >{/if}</span
                        >
                      {/if}
                    </li>
                  {:else}
                    <li class="muted small">{layer.byTeam ? 'Niemand' : 'Noch keine Funktionen eingetragen.'}</li>
                  {/each}
                </ul>
              </div>
            {/each}
          {/each}
        </div>
      </div>
    {/snippet}
  </AsyncView>
</Page>

<style>
  /* The knockout bracket's cards and 1px connectors: layers top-down, a team's coaches joined to its players. */
  .scroll {
    --gap: var(--space-xl);
    --line: var(--color-border-strong);
    overflow-x: auto;
    padding-bottom: var(--space-md);
  }
  .layers {
    display: grid;
    grid-template-columns: 11rem repeat(var(--teams), minmax(14rem, 1fr));
    gap: var(--gap) var(--space-md);
    width: max-content;
    min-width: 100%;
  }
  .label {
    position: relative;
    display: grid;
    align-content: start;
    gap: var(--space-xxs);
    grid-column: 1;
    margin: 0;
    padding: var(--space-xs) var(--space-sm);
    border: 1px solid var(--color-accent);
    border-radius: var(--radius-md);
    background: var(--color-accent-soft);
    color: var(--color-accent);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-bold);
  }
  /* The spine: each layer hangs from the one above. */
  .label:not(:first-child)::before {
    position: absolute;
    bottom: 100%;
    left: 50%;
    height: var(--gap);
    border-left: 1px solid var(--line);
    content: '';
  }
  .count {
    color: var(--color-text);
    font-size: var(--font-size-small);
    font-variant-numeric: tabular-nums;
  }
  .cell {
    position: relative;
    min-width: 0;
  }
  .cell.wide {
    grid-column: 2 / -1;
  }
  /* A team's players hang from its coaches: the line runs from the last coach down through the gap. */
  .cell.feeds {
    display: flex;
    flex-direction: column;
  }
  .cell.feeds::after {
    flex: 1;
    align-self: center;
    border-left: 1px solid var(--line);
    content: '';
  }
  .cell.linked::before {
    position: absolute;
    bottom: 100%;
    left: 50%;
    height: var(--gap);
    border-left: 1px solid var(--line);
    content: '';
  }
  .team {
    margin: 0 0 var(--space-xs);
    padding: var(--space-xxs) var(--space-sm);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    font-size: var(--font-size-small);
    font-weight: var(--font-weight-bold);
    text-align: center;
  }
  .cards {
    display: grid;
    gap: var(--space-sm);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .wide .cards {
    grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
  }
  .card {
    display: grid;
    align-content: start;
    gap: var(--space-xxs);
    padding: var(--space-xs) var(--space-sm);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    transition:
      border-color var(--motion-fast) var(--motion-easing),
      box-shadow var(--motion-fast) var(--motion-easing);
  }
  .card.marked {
    border-color: var(--color-accent);
    box-shadow: var(--color-shadow-raised);
  }
  .card.inactive {
    border-style: dashed;
    background: transparent;
    color: var(--color-text-faint);
  }
  .role {
    color: var(--color-text-muted);
    font-size: var(--font-size-small);
  }
  .name {
    overflow: hidden;
    font-weight: var(--font-weight-medium);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .relative {
    color: var(--color-text-muted);
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xxs);
  }
  :global([data-layout='compact']) .layers {
    grid-template-columns: minmax(0, 1fr);
    width: auto;
  }
  :global([data-layout='compact']) .cell.wide {
    grid-column: 1;
  }
  :global([data-layout='compact']) .label::before,
  :global([data-layout='compact']) .cell.feeds::after,
  :global([data-layout='compact']) .cell.linked::before {
    display: none;
  }
</style>
