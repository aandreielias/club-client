<script lang="ts">
  import { directory, preferences, store } from '../../lib/container';
  import { Resource } from '../../lib/state/Resource.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import Icon from '../../ui/Icon.svelte';
  import { filesApi } from '../files/services';
  import { locationsApi } from '../locations/services';
  import { mailApi } from '../mail/services';
  import { resolutionRules } from '../meetings/services';
  import { membersApi } from '../members/services';
  import { setupSteps } from './SetupChecklist';

  /** Start page card for admins of a new club: what is still to set up; each step ticks itself off. */
  const VISITED = 'setup-visited';
  let visited = $state(new Set(store.get<string[]>(VISITED) ?? []));

  // A failing source counts as "not done yet" instead of hiding the card.
  const or = <T,>(promise: Promise<T>, fallback: T): Promise<T> => promise.catch(() => fallback);

  const steps = new Resource(async () => {
    const [members, mail, board, locations, folders, rules] = await Promise.all([
      or(directory.allMembers(), []),
      or(mailApi.settings(), null),
      or(membersApi.board(), null),
      or(locationsApi.list(), []),
      or(filesApi.folders(), []),
      or(resolutionRules.load(), null),
    ]);
    const active = members.filter((m) => m.active);
    const admins = active.filter((m) => m.roles.includes('ADMIN')).length;
    return {
      admins,
      mailDomain: !!mail?.domain,
      offices: board?.offices.length ?? 0,
      teams: directory.teams.length,
      locations: locations.length,
      folders: folders.length,
      statutes: !!rules?.statutes.folderId,
      members: active.length - admins,
    };
  });
  void steps.load();

  function visit(id: string) {
    if (visited.has(id)) return;
    visited = new Set([...visited, id]);
    store.set(VISITED, [...visited]);
  }

  function hide() {
    preferences.set('homeShown', { ...preferences.values.homeShown, setup: false });
  }
</script>

<h2>Einrichtung</h2>
<AsyncView resource={steps}>
  {#snippet children(facts)}
    {@const list = setupSteps({ ...facts, visited })}
    {@const open = list.filter((s) => !s.done).length}
    <p class="muted small">
      {open ? `Noch ${open} von ${list.length} Schritten offen.` : 'Alles eingerichtet.'} Die Karte lässt sich unter „Anpassen“ wieder einblenden.
    </p>
    <ol class="steps">
      {#each list as step (step.id)}
        <li class:done={step.done} class:warn={step.warn}>
          <Icon name={step.done ? 'check' : step.warn ? 'alert' : 'next'} small />
          <span>
            <a href={step.href} onclick={() => visit(step.id)}>{step.label}</a>
            {#if !step.done}<span class="muted small">{step.detail}</span>{/if}
          </span>
        </li>
      {/each}
    </ol>
    <div><Button size="sm" variant="ghost" onclick={hide}>Ausblenden</Button></div>
  {/snippet}
</AsyncView>

<style>
  p {
    margin: 0;
  }
  .steps {
    display: grid;
    gap: var(--space-xs);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .steps li {
    display: flex;
    gap: var(--space-sm);
    align-items: baseline;
  }
  .steps li > span {
    display: grid;
  }
  .done a {
    color: var(--color-text-muted);
    text-decoration: line-through;
  }
  .warn {
    color: var(--color-danger);
  }
</style>
