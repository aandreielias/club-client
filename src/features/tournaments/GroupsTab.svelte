<script lang="ts">
  import Empty from '../../ui/Empty.svelte';
  import type { Tournament } from './model';
  import Button from '../../ui/Button.svelte';
  import ResultDialog from './ResultDialog.svelte';
  import { matchPlace, type TournamentMatch } from './model';
  import type { TournamentModel } from './TournamentModel.svelte';
  import { tournamentPolicy as policy } from './services';

  /** Per group: the table (the qualifying places marked) and its matches with scores to enter. */
  let { tournament, model }: { tournament: Tournament; model: TournamentModel } = $props();

  const editable = $derived(policy.canManage() && tournament.status === 'GROUPS');
  let editing = $state<TournamentMatch | null>(null);
  /** Simple tournaments note only who won: draws instead of sets and ball points. */
  const simple = $derived(tournament.format === 'SIMPLE');
  const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
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
              {#if simple}<th class="num" title="Unentschieden">U</th>{/if}<th class="num" title="Niederlagen">N</th>
              {#if !simple}<th class="num">Sätze</th><th class="num" title="Ballpunkte">Bälle</th>{/if}<th class="num" title="Tabellenpunkte">Pkt</th>
            </tr>
          </thead>
          <tbody>
            {#each group.standings as row, i (row.teamId)}
              <tr class:qualifies={i < tournament.advancePerGroup}>
                <td class="num">{i + 1}</td>
                <td class="team">{row.name}</td>
                <td class="num">{row.played}</td><td class="num">{row.won}</td>{#if simple}<td class="num">{row.drawn}</td>{/if}<td class="num">{row.lost}</td>
                {#if !simple}
                  <td class="num" title="Differenz {signed(row.setsWon - row.setsLost)}">{row.setsWon}:{row.setsLost}</td>
                  <td class="num" title="Differenz {signed(row.ballsWon - row.ballsLost)}">{row.ballsWon}:{row.ballsLost}</td>
                {/if}
                <td class="num points">{row.points}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        <ul class="matches">
          {#each matches as m (m.id)}
            <li>
              <span class="home">{model.teamName(m.homeId)}</span>
              <span class="result" class:open={m.homeScore === null}>{m.homeScore === null ? '–:–' : `${m.homeScore}:${m.awayScore}`}</span>
              <span class="away">{model.teamName(m.awayId)}</span>
              <span class="end">
                {#if m.field || m.wave}<span class="muted small">{matchPlace(m)}</span>{/if}
                {#if editable}
                  <Button size="sm" variant="ghost" icon={m.homeScore === null ? 'add' : 'edit'} tooltip="Ergebnis eintragen" onclick={() => (editing = m)} />
                {/if}
              </span>
              {#if m.sets.length}<span class="sets muted small">{m.sets.map((s) => `${s.home}:${s.away}`).join(' · ')}</span>{/if}
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  </div>
  {#if editing}<ResultDialog match={editing} {model} onclose={() => (editing = null)} />{/if}
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
  .end {
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-xs);
    min-width: 4rem;
  }
  .sets {
    grid-column: 1 / -1;
    margin-top: calc(-1 * var(--space-xxs));
    text-align: center;
    font-variant-numeric: tabular-nums;
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
