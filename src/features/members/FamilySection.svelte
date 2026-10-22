<script lang="ts">
  import { Resource } from '../../lib/state/Resource.svelte';
  import RecordLink from '../../ui/RecordLink.svelte';
  import Tag from '../../ui/Tag.svelte';
  import { tooltip } from '../../ui/tooltip';
  import type { Relative } from './MembersApi';
  import { membersApi } from './services';

  /** Who is guardian of whom, on both profiles, with what a guardian may do (server: every module's ward checks). */
  let { memberId, firstName, self = false }: { memberId: string; firstName: string; self?: boolean } = $props();

  // svelte-ignore state_referenced_locally
  const family = new Resource(() => membersApi.family(memberId));
  void family.load();

  const RIGHTS = [
    'Termine, Aufgaben, Team-Ordner und Nachrichten sehen und Erinnerungen dazu bekommen',
    'für sie zu- und absagen, Abwesenheiten und Mitfahrten eintragen',
    'ihre Aufgaben bearbeiten (Status, Checkliste)',
    'Telefon und Foto-Einwilligung ändern, ein fehlendes Geburtsdatum eintragen',
    'Geburtsdatum und ausgeliehene Sachen sehen',
  ];
  const names = (list: Relative[]) => list.map((r) => r.name.split(' ')[0]).join(', ');
</script>

{#snippet people(list: Relative[])}
  {#each list as relative (relative.memberId)}
    <RecordLink kind="member" id={relative.memberId} allowed={relative.canOpen} hint="Profil öffnen"><Tag tone="purple">{relative.name}</Tag></RecordLink>
  {/each}
{/snippet}

{#if family.value && (family.value.guardians.length || family.value.wards.length)}
  {@const { guardians, wards } = family.value}
  <h2>Familie</h2>
  <dl class="props">
    {#if guardians.length}
      <dt>Erziehungsberechtigte</dt>
      <dd class="names">{@render people(guardians)}</dd>
    {/if}
    {#if wards.length}
      <dt>Erziehungsberechtigt für</dt>
      <dd class="names">{@render people(wards)}</dd>
    {/if}
  </dl>
  <details class="rights">
    <summary {@attach tooltip('Was Erziehungsberechtigte in der App tun können')}>
      {#if wards.length}{self ? 'Du kannst' : `${firstName} kann`} für {names(wards)} …{:else}{names(guardians)} {guardians.length > 1 ? 'können' : 'kann'} für {self ? 'dich' : firstName} …{/if}
    </summary>
    <ul>
      {#each RIGHTS as right (right)}<li>{right}</li>{/each}
    </ul>
    <p class="muted small">Die Verknüpfung legen Admin oder Vorstand an und lösen sie. Sie ist unabhängig von der Rolle „Elternteil“.</p>
  </details>
{/if}

<style>
  .names {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs);
  }
  .rights {
    margin-top: var(--space-sm);
    font-size: var(--font-size-small);
  }
  .rights summary {
    width: fit-content;
    color: var(--color-text-muted);
    cursor: pointer;
  }
  .rights ul {
    margin: var(--space-xs) 0;
    padding-left: var(--space-lg);
  }
</style>
