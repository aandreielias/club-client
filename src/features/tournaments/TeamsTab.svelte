<script lang="ts">
  import { bus, permissions, session } from '../../lib/container';
  import { TOAST } from '../../channels';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Select from '../../ui/Select.svelte';
  import Tag from '../../ui/Tag.svelte';
  import GuestDialog from './GuestDialog.svelte';
  import type { Tournament } from './model';
  import type { TournamentModel } from './TournamentModel.svelte';
  import { tournamentPolicy as policy } from './services';

  /** The teams (editable until the draw; own teams can be linked) and the guest accounts of visiting teams. */
  let { tournament, model }: { tournament: Tournament; model: TournamentModel } = $props();

  const editable = $derived(policy.canManage() && tournament.status === 'DRAFT');
  // svelte-ignore state_referenced_locally
  let lines = $state(tournament.teams.map((t) => ({ key: t.id, id: t.id as string | null, name: t.name, clubTeamId: t.clubTeamId ?? '' })));
  let next = 0;
  let inviting = $state(false);
  const clubTeams = $derived([{ value: '', label: 'Gastteam' }, ...permissions.filterableTeams().map((t) => ({ value: t.id, label: `Eigenes Team: ${t.name}` }))]);
  const dirty = $derived(JSON.stringify(lines.map(({ id, name, clubTeamId }) => [id, name.trim(), clubTeamId]))
    !== JSON.stringify(tournament.teams.map((t) => [t.id, t.name, t.clubTeamId ?? ''])));

  function add() {
    lines = [...lines, { key: `new-${next++}`, id: null, name: '', clubTeamId: '' }];
  }

  async function save() {
    const teams = lines.filter((l) => l.name.trim()).map((l) => ({ id: l.id, name: l.name.trim(), clubTeamId: l.clubTeamId || null }));
    if (await model.setTeams(teams)) bus.publish(TOAST, { text: 'Teams gespeichert.' });
  }

  // A fresh answer (e.g. after saving) resets the lines.
  $effect(() => {
    lines = tournament.teams.map((t) => ({ key: t.id, id: t.id, name: t.name, clubTeamId: t.clubTeamId ?? '' }));
  });
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
{:else}
  <ul class="teams">
    {#each tournament.teams as team (team.id)}
      <li>
        <span>{team.name}</span>
        {#if team.clubTeamId}<Tag tone="blue">Eigenes Team</Tag>{/if}
        {#if team.group}<span class="muted">Gruppe {team.group}</span>{/if}
      </li>
    {/each}
  </ul>
{/if}

{#if policy.canManage()}
  <h2 class="heading">
    Gastzugänge
    {#if policy.canInviteGuests()}<Button size="sm" variant="ghost" icon="add" onclick={() => (inviting = true)}>Gastzugang anlegen</Button>{/if}
  </h2>
  <p class="muted small">Gastteams sehen damit nur dieses Turnier: Tabellen, Spielplan und KO-Runde. Die Zugänge werden einen Monat nach dem Turnier gelöscht.</p>
  {#if tournament.guests.length}
    <ul class="teams">
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
  .lines,
  .teams {
    display: grid;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .lines {
    gap: var(--space-xs);
    margin-bottom: var(--space-sm);
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
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-sm);
    min-height: var(--control-height);
    border-bottom: 1px solid var(--color-border);
  }
  .between {
    justify-content: space-between;
  }
  .heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .small {
    font-size: var(--font-size-small);
  }
</style>
