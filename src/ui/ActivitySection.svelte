<script lang="ts">
  import { activityApi, permissions, session } from '../lib/container';
  import { ACTIVITY_ACTIONS, type ActivityEntry, type ActivityKind } from '../lib/activity/ActivityApi';
  import { Resource } from '../lib/state/Resource.svelte';
  import AsyncView from './AsyncView.svelte';

  /**
   * "Verlauf": who changed this task, appointment or file and when. Only admin, board and coaches
   * (the server refuses everyone else); loads when opened.
   */
  let { kind, id, describe }: { kind: ActivityKind; id: string; describe?: (entry: ActivityEntry) => string | null } = $props();

  // svelte-ignore state_referenced_locally
  const log = new Resource(() => activityApi.list(kind, id));

  const text = (e: ActivityEntry) => describe?.(e) ?? ACTIVITY_ACTIONS[e.action] ?? e.action;

  function toggle(event: Event) {
    if ((event.currentTarget as HTMLDetailsElement).open) void log.load();
  }
</script>

{#if permissions.isPrivileged}
  <details class="activity" ontoggle={toggle}>
    <summary>Verlauf</summary>
    <AsyncView resource={log}>
      {#snippet children(entries)}
        {#if entries.length}
          <ol>
            {#each entries as entry, i (i)}
              <li>
                <span class="who">{entry.actorName ?? 'Gelöschtes Mitglied'}</span>
                <span>{text(entry)}</span>
                <time class="muted" datetime={entry.at}>{session.format.dateTime(entry.at)}</time>
              </li>
            {/each}
          </ol>
        {:else}
          <p class="muted">Noch keine Änderungen aufgezeichnet.</p>
        {/if}
      {/snippet}
    </AsyncView>
  </details>
{/if}

<style>
  .activity {
    margin-top: var(--space-lg);
  }
  summary {
    cursor: pointer;
    color: var(--color-text-muted);
    font-size: var(--font-size-small);
    font-weight: var(--font-weight-medium);
  }
  ol {
    list-style: none;
    margin: var(--space-sm) 0 0;
    padding: 0;
    display: grid;
    gap: var(--space-xs);
  }
  li {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs) var(--space-sm);
    font-size: var(--font-size-small);
  }
  .who {
    font-weight: var(--font-weight-medium);
  }
  time {
    margin-left: auto;
    font-variant-numeric: tabular-nums;
  }
</style>
