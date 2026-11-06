<script lang="ts">
  /** Board size warnings (too few people, an even number): shown in red. */
  const SIZE_WARNINGS = ['board.too-small', 'board.even'];
  import { bus, permissions, session } from '../../lib/container';
  import RecordLink from '../../ui/RecordLink.svelte';
  import { CONFIRM, TOAST, WINDOW_OPEN } from '../../channels';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import { OFFICES_CHANGED } from './events';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Icon from '../../ui/Icon.svelte';
  import Page from '../../ui/Page.svelte';
  import Tag from '../../ui/Tag.svelte';
  import { BoardModel } from './BoardModel.svelte';
  import { boardWarning } from './messages';
  import type { Office } from './MembersApi';
  import { boardSettings, memberPolicy as policy, membersApi } from './services';

  /** Vorstand and Rechnungsprüfer: who holds which function, until when. */
  const model = new BoardModel(membersApi);
  void model.load();

  const today = session.clock.today();
  useBus(bus, OFFICES_CHANGED, () => void model.load());

  async function end(o: Office) {
    const ok = await bus.request(CONFIRM, {
      title: 'Funktion beenden',
      message: `${o.name} ist ab heute nicht mehr ${boardSettings.label(o.office)}.${boardSettings.isBoard(o.office) ? ' Die Vorstandsrolle endet mit der letzten Funktion im Vorstand.' : ''}`,
      confirmLabel: 'Beenden',
      danger: true,
    });
    if (!ok || !(await model.end(o.id))) return;
    bus.publish(TOAST, { text: 'Funktion beendet.' });
    if (o.memberId === session.member.id) await session.loadMe();
  }
</script>

{#snippet list(offices: Office[], empty: string)}
  <ul class="rows offices">
    {#each offices as o (o.id)}
      <li>
        <span class="function">{boardSettings.label(o.office)}</span>
        <span
          ><RecordLink kind="member" id={o.memberId} allowed={permissions.canSeeMember(o.memberId)}>{o.name}</RecordLink>{#if o.coopted}
            <Tag tone="orange">Kooptiert</Tag>{/if}</span
        >
        <span class="muted small"
          >{session.format.date(o.startsOn)} bis {session.format.date(o.termEndsOn)}{#if o.startsOn > today}
            <Tag>Beginnt später</Tag>{/if}</span
        >
        {#if policy.canManageOffices()}
          <Button size="sm" variant="ghost" busy={model.endAction.busy} onclick={() => end(o)}>Beenden</Button>
        {/if}
      </li>
    {:else}
      <li class="muted">{empty}</li>
    {/each}
  </ul>
{/snippet}

<Page title="Vorstand">
  {#snippet actions()}
    {#if policy.canManageOffices()}
      <Button variant="primary" icon="add" onclick={() => bus.publish(WINDOW_OPEN, { kind: 'office-assign', id: '-' })}>Funktion vergeben</Button>
    {/if}
  {/snippet}
  <AsyncView resource={model.board}>
    {#snippet children(board)}
      {#if board.warnings.length}
        <ul class="warnings">
          {#each board.warnings as code (code)}<li class:danger={SIZE_WARNINGS.includes(code)}>
              <Icon name="alert" small />
              {boardWarning(code, boardSettings.value)}
            </li>{/each}
        </ul>
      {/if}
      <h2>Vorstandsfunktionen</h2>
      {@render list(
        board.offices.filter((o) => boardSettings.isBoard(o.office)),
        'Noch keine Funktionen eingetragen.',
      )}
      <h2>Weitere Funktionen</h2>
      {@render list(
        board.offices.filter((o) => !boardSettings.isBoard(o.office)),
        'Noch keine Rechnungsprüfer:innen oder weiteren Funktionen eingetragen.',
      )}
      <ErrorNote error={model.endAction.error} />
    {/snippet}
  </AsyncView>
</Page>

<style>
  .offices {
    margin: 0 0 var(--space-md);
  }
  .offices li {
    display: grid;
    grid-template-columns: 10rem minmax(0, 1fr) auto auto;
    gap: var(--space-md);
  }
  .function {
    font-weight: var(--font-weight-medium);
  }
  .warnings {
    display: grid;
    gap: var(--space-xs);
    margin: 0 0 var(--space-md);
    padding: 0;
    list-style: none;
    color: var(--color-warning);
  }
  .warnings .danger {
    color: var(--color-danger);
  }
  :global([data-layout='compact']) .offices li {
    grid-template-columns: 1fr auto;
  }
</style>
