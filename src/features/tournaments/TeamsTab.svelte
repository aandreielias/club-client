<script lang="ts">
  import { untrack } from 'svelte';
  import { bus, permissions, session } from '../../lib/container';
  import { TOAST } from '../../channels';
  import SectionHeading from '../../ui/SectionHeading.svelte';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Select from '../../ui/Select.svelte';
  import Tag from '../../ui/Tag.svelte';
  import GuestDialog from './GuestDialog.svelte';
  import StandingsTable from './StandingsTable.svelte';
  import { teamStats } from './logic';
  import type { Tournament } from './model';
  import type { TournamentModel } from './TournamentModel.svelte';
  import { tournamentPolicy as policy } from './services';

  /** The teams (editable until the draw; own teams can be linked) and the guest accounts of visiting teams. */
  let { tournament, model }: { tournament: Tournament; model: TournamentModel } = $props();

  const editable = $derived(policy.canManage() && tournament.status === 'DRAFT');
  type Line = { key: string; id: string | null; name: string; clubTeamId: string };
  const linesOf = (teams: Tournament['teams']): Line[] => teams.map((t) => ({ key: t.id, id: t.id, name: t.name, clubTeamId: t.clubTeamId ?? '' }));
  const keyOf = (teams: readonly { id: string | null; name: string; clubTeamId: string | null }[]) =>
    JSON.stringify(teams.map((t) => [t.id, t.name.trim(), t.clubTeamId ?? '']));
  // svelte-ignore state_referenced_locally
  let lines = $state(linesOf(tournament.teams));
  // svelte-ignore state_referenced_locally
  let shown = tournament.teams; // the teams the lines were last reset to
  let next = 0;
  let inviting = $state(false);
  const clubTeams = $derived([
    { value: '', label: 'Gastteam' },
    ...permissions.filterableTeams().map((t) => ({ value: t.id, label: `Eigenes Team: ${t.name}` })),
  ]);
  const dirty = $derived(keyOf(lines) !== keyOf(tournament.teams));

  function add() {
    lines = [...lines, { key: `new-${next++}`, id: null, name: '', clubTeamId: '' }];
  }

  async function save() {
    const teams = lines.filter((l) => l.name.trim()).map((l) => ({ id: l.id, name: l.name.trim(), clubTeamId: l.clubTeamId || null }));
    if (await model.setTeams(teams)) bus.publish(TOAST, { text: 'Teams gespeichert.' });
  }

  // A fresh answer (after saving, or another manager's change) resets the lines, unless they hold unsaved edits.
  $effect(() => {
    const teams = tournament.teams;
    untrack(() => {
      if (keyOf(lines) === keyOf(shown)) lines = linesOf(teams);
      shown = teams;
    });
  });
  const simple = $derived(tournament.format === 'SIMPLE');
  const stats = $derived(teamStats(tournament));
</script>

{#if editable}
  <ul class="lines">
    {#each lines as line, i (line.key)}
      <li>
        <span class="muted index">{i + 1}</span>
        <input bind:value={line.name} maxlength="80" placeholder="Teamname" aria-label="Team {i + 1}" />
        <Select bind:value={line.clubTeamId} options={clubTeams} aria-label="Eigenes Team, Zeile {i + 1}" />
        <Button size="sm" variant="ghost" icon="close" tooltip="Team entfernen" onclick={() => (lines = lines.filter((l) => l.key !== line.key))} />
      </li>
    {/each}
  </ul>
  <div class="row between">
    <Button size="sm" icon="add" onclick={add}>Team hinzufügen</Button>
    <Button variant="primary" disabled={!dirty} busy={model.action.busy} onclick={save}>Teams speichern</Button>
  </div>
  <ErrorNote error={model.action.error} />
{:else if tournament.status === 'DRAFT'}
  <ul class="rows teams">
    {#each tournament.teams as team (team.id)}
      <li>
        <span>{team.name}</span>
        {#if team.clubTeamId}<Tag tone="blue">Eigenes Team</Tag>{/if}
      </li>
    {/each}
  </ul>
{:else}
  <!-- After the draw: every team over the whole tournament, group and knockout. -->
  <StandingsTable rows={stats} {simple} overall own={(id) => !!tournament.teams.find((t) => t.id === id)?.clubTeamId} />
{/if}

{#if policy.canManage()}
  <SectionHeading title="Gastzugänge">
    {#snippet actions()}
      {#if policy.canInviteGuests()}<Button size="sm" variant="ghost" icon="add" onclick={() => (inviting = true)}>Gastzugang anlegen</Button>{/if}
    {/snippet}
  </SectionHeading>
  <p class="muted small">
    Gastteams sehen damit nur dieses Turnier: Tabellen, Spielplan und KO-Runde. Die Zugänge werden einen Monat nach dem Turnier gelöscht.
  </p>
  {#if tournament.guests.length}
    <ul class="rows teams">
      {#each tournament.guests as guest (guest.memberId)}
        <li>
          <span>{guest.name}</span>
          {#if guest.teamId}<span class="muted">{model.teamName(guest.teamId)}</span>{/if}
          <span class="muted small">gelöscht am {session.format.date(guest.deletedOn)}</span>
        </li>
      {/each}
    </ul>
  {/if}
{/if}

{#if inviting}<GuestDialog {tournament} {model} onclose={() => (inviting = false)} />{/if}

<style>
  .lines {
    display: grid;
    gap: var(--space-xs);
    margin: 0 0 var(--space-sm);
    padding: 0;
    list-style: none;
  }
  .lines li {
    display: grid;
    grid-template-columns: 1.5rem minmax(0, 2fr) minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-sm);
  }
  .index {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .teams li {
    justify-content: flex-start;
  }
</style>
