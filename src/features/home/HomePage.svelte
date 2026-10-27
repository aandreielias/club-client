<script lang="ts">
  import { bus, homeSections, preferences, session } from '../../lib/container';
  import { WINDOW_OPEN } from '../../channels';
  import Button from '../../ui/Button.svelte';
  import Page from '../../ui/Page.svelte';
  import Tag from '../../ui/Tag.svelte';

  /** Greeting plus the sections the member chose in Einstellungen > Startseite, each on its own card. */
  const sections = $derived(homeSections.shown(preferences.values.homeOrder, preferences.values.homeShown, (...roles) => session.hasRole(...roles)));
</script>

<Page title="Hallo {session.member.firstName}">
  {#snippet actions()}
    <Button
      icon="settings"
      onclick={() => bus.publish(WINDOW_OPEN, { kind: 'settings', id: 'home' })}
      tooltip="Abschnitte der Startseite auswählen und ordnen">Anpassen</Button
    >
  {/snippet}
  {#snippet context()}
    <span class="muted">{session.club?.name}</span>
    {#each session.teams as team (team.id)}<Tag tone="blue">{team.name}</Tag>{/each}
  {/snippet}

  <div class="sections">
    {#each sections as section (section.id)}
      <section class="card">
        <section.component />
      </section>
    {:else}
      <p class="muted">Alle Abschnitte sind ausgeblendet. Unter „Anpassen“ lassen sie sich wieder einschalten.</p>
    {/each}
  </div>
</Page>

<style>
  .sections {
    display: grid;
    gap: var(--space-lg);
  }
  /* Each section on its own light card, so they stay apart. */
  .card {
    display: grid;
    gap: var(--space-sm);
    min-width: 0;
    padding: var(--space-lg) var(--space-xl) var(--space-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    background: var(--color-surface);
  }
  .card :global(h2:first-child) {
    margin: 0;
  }
  :global([data-layout='compact']) .card {
    padding: var(--space-md);
  }
</style>
