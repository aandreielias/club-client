<script lang="ts">
  import Empty from '../../ui/Empty.svelte';
  import type { Tournament } from './model';
  import ScoreEditor from './ScoreEditor.svelte';
  import type { TournamentModel } from './TournamentModel.svelte';
  import { tournamentPolicy as policy } from './services';

  /** Per group: the table (the qualifying places marked) and its matches with scores to enter. */
  let { tournament, model }: { tournament: Tournament; model: TournamentModel } = $props();

  const editable = $derived(policy.canManage() && tournament.status === 'GROUPS');
</script>

{#if !tournament.groups.length}
  <Empty text="Noch nicht ausgelost. Erst die Teams eintragen, dann auslosen." />
{:else}
  <div class="groups">
    {#each tournament.groups as group (group.label)}
      {@const matches = tournament.matches.filter((m) => m.stage === 'GROUP' && m.group === group.label)}
      <section class="group">
        <h2>Gruppe {group.label}</h2>
        <table>
          <thead>
            <tr>
              <th class="num" title="Platz">Pl</th><th>Team</th><th class="num" title="Spiele">Sp</th><th class="num" title="Siege">S</th>
              <th class="num" title="Unentschieden">U</th><th class="num" title="Niederlagen">N</th><th class="num">Tore</th>
              <th class="num" title="Tordifferenz">Diff</th><th class="num" title="Punkte">Pkt</th>
            </tr>
          </thead>
          <tbody>
            {#each group.standings as row, i (row.teamId)}
              {@const diff = row.goalsFor - row.goalsAgainst}
              <tr class:qualifies={i < tournament.advancePerGroup}>
                <td class="num">{i + 1}</td>
                <td class="team">{row.name}</td>
                <td class="num">{row.played}</td><td class="num">{row.won}</td><td class="num">{row.drawn}</td><td class="num">{row.lost}</td>
                <td class="num">{row.goalsFor}:{row.goalsAgainst}</td>
                <td class="num">{diff > 0 ? `+${diff}` : diff}</td>
                <td class="num points">{row.points}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        <ul class="matches">
          {#each matches as m (m.id)}
            <li>
              <span class="home">{model.teamName(m.homeId)}</span>
              {#if editable}
                <ScoreEditor match={m} {model} />
              {:else}
                <span class="result" class:open={m.homeScore === null}>{m.homeScore === null ? '–:–' : `${m.homeScore}:${m.awayScore}`}</span>
              {/if}
              <span class="away">{model.teamName(m.awayId)}</span>
              {#if m.field}<span class="muted small field">{m.field}</span>{/if}
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  </div>
  <p class="muted small legend"><span class="bar" aria-hidden="true"></span> Weiter in die KO-Runde</p>
{/if}

<style>
  .groups {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(22rem, 1fr));
    gap: var(--space-lg);
  }
  .group {
    padding: var(--space-md) var(--space-lg) var(--space-lg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
  }
  .group h2 {
    margin-top: 0;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--font-size-small);
  }
  th {
    color: var(--color-text-muted);
    font-weight: var(--font-weight-medium);
    text-align: left;
  }
  th,
  td {
    padding: var(--space-xs) var(--space-xs);
    border-bottom: 1px solid var(--color-border);
  }
  .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .team {
    width: 100%;
    font-size: var(--font-size-base);
  }
  .points {
    font-weight: var(--font-weight-bold);
  }
  /* Qualifying places: a thin accent bar on the left. */
  tr.qualifies td:first-child {
    box-shadow: inset 2px 0 0 var(--color-accent);
  }
  .matches {
    display: grid;
    margin: var(--space-md) 0 0;
    padding: 0;
    list-style: none;
  }
  .matches li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-sm);
    min-height: var(--control-height);
    padding: var(--space-xxs) 0;
  }
  .home {
    text-align: right;
  }
  .home,
  .away {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .result {
    min-width: 4rem;
    font-variant-numeric: tabular-nums;
    font-weight: var(--font-weight-bold);
    text-align: center;
  }
  .result.open {
    color: var(--color-text-faint);
    font-weight: normal;
  }
  .small {
    font-size: var(--font-size-small);
  }
  .legend {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
  }
  .bar {
    width: 2px;
    height: 1em;
    background: var(--color-accent);
  }
</style>
