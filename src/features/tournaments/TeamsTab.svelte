<script lang="ts">
  import { untrack } from 'svelte';
  import { bus, permissions, session } from '../../lib/container';
  import { TOAST } from '../../channels';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Select from '../../ui/Select.svelte';
  import Tag from '../../ui/Tag.svelte';
  import GuestDialog from './GuestDialog.svelte';
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
  const clubTeams = $derived([{ value: '', label: 'Gastteam' }, ...permissions.filterableTeams().map((t) => ({ value: t.id, label: `Eigenes Team: ${t.name}` }))]);
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
  const knockout = $derived(stats.some((s) => s.knockout !== null));
  const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
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
  <ul class="teams">
    {#each tournament.teams as team (team.id)}
      <li>
        <span>{team.name}</span>
        {#if team.clubTeamId}<Tag tone="blue">Eigenes Team</Tag>{/if}
      </li>
    {/each}
  </ul>
{:else}
  <!-- After the draw: every team over the whole tournament, group and knockout. -->
  <div class="scroll">
    <table class="stats">
      <thead>
        <tr>
          <th>Team</th><th title="Gruppe">Gr.</th><th class="num" title="Platz in der Gruppe">Pl</th>
          <th class="num" title="Spiele">Sp</th><th class="num" title="Siege">S</th>
          {#if simple}<th class="num" title="Unentschieden">U</th>{/if}<th class="num" title="Niederlagen">N</th>
          {#if !simple}<th class="num">Sätze</th><th class="num" title="Ballpunkte">Bälle</th>{/if}
          <th class="num" title="Tabellenpunkte der Gruppe">Pkt</th>
          {#if knockout}<th>KO-Runde</th>{/if}
        </tr>
      </thead>
      <tbody>
        {#each stats as s (s.teamId)}
          <tr>
            <td class="team">
              {s.name}
              {#if tournament.teams.find((t) => t.id === s.teamId)?.clubTeamId}<Tag tone="blue">Eigenes Team</Tag>{/if}
            </td>
            <td>{s.group ?? '–'}</td>
            <td class="num">{s.rank ?? '–'}</td>
            <td class="num">{s.played}</td><td class="num">{s.won}</td>
            {#if simple}<td class="num">{s.drawn}</td>{/if}<td class="num">{s.lost}</td>
            {#if !simple}
              <td class="num" title="Differenz {signed(s.setsWon - s.setsLost)}">{s.setsWon}:{s.setsLost}</td>
              <td class="num" title="Differenz {signed(s.ballsWon - s.ballsLost)}">{s.ballsWon}:{s.ballsLost}</td>
            {/if}
            <td class="num points">{s.points ?? '–'}</td>
            {#if knockout}<td class="ko" class:winner={s.knockout === 'Sieger'}>{s.knockout}</td>{/if}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
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
  .scroll {
    overflow-x: auto;
  }
  .stats {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--font-size-small);
  }
  .stats th {
    color: var(--color-text-muted);
    font-weight: var(--font-weight-medium);
    text-align: left;
    white-space: nowrap;
  }
  .stats th,
  .stats td {
    padding: var(--space-xs);
    border-bottom: 1px solid var(--color-border);
  }
  .stats .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .stats .team {
    width: 100%;
    font-size: var(--font-size-base);
  }
  .stats .points {
    font-weight: var(--font-weight-bold);
  }
  .ko {
    white-space: nowrap;
  }
  .ko.winner {
    font-weight: var(--font-weight-bold);
    color: var(--color-accent);
  }
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
