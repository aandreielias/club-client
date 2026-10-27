<script lang="ts">
  import { session } from '../../lib/container';
  import { Resource } from '../../lib/state/Resource.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Icon from '../../ui/Icon.svelte';
  import SectionHeading from '../../ui/SectionHeading.svelte';
  import { boardWarning } from './messages';
  import { boardSettings, membersApi } from './services';

  /** Start page section: who holds which office until when, and the gaps to close (server: BoardRules.warnings). */
  const board = new Resource(() => membersApi.board());
  void board.load();
</script>

<SectionHeading title="Vorstand" href="#/board" />
<AsyncView resource={board}>
  {#snippet children(b)}
    {#each b.warnings as code (code)}
      <p class="warning small"><Icon name="alert" small /> {boardWarning(code, boardSettings.value)}</p>
    {/each}
    <ul>
      {#each b.offices as o (o.id)}
        <li>
          <span>{boardSettings.label(o.office)}</span><span>{o.name}</span><span class="muted small">bis {session.format.date(o.termEndsOn)}</span>
        </li>
      {:else}
        <li class="muted">Noch keine Funktionen eingetragen.</li>
      {/each}
    </ul>
  {/snippet}
</AsyncView>

<style>
  ul {
    display: grid;
    gap: var(--space-xs);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: grid;
    grid-template-columns: 11rem minmax(0, 1fr) auto;
    gap: var(--space-sm);
    align-items: baseline;
  }
  .warning {
    margin: 0 0 var(--space-xs);
    color: var(--color-warning);
  }
</style>
