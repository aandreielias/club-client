<script lang="ts">
  import Tag from '../../ui/Tag.svelte';
  import type { TeamStats } from './logic';
  import type { StandingRow } from './model';

  type Row = StandingRow | TeamStats;

  /**
   * One standings table: a group's (place = order, the first `qualify` marked) or the whole tournament's (`overall`: group,
   * place in it and the knockout result). Simple tournaments count draws instead of sets and ball points.
   */
  let {
    rows,
    simple,
    qualify = 0,
    overall = false,
    own = () => false,
  }: { rows: readonly Row[]; simple: boolean; qualify?: number; overall?: boolean; own?: (teamId: string) => boolean } = $props();

  const stats = (r: Row) => ('knockout' in r ? r : null);
  const knockout = $derived(overall && rows.some((r) => stats(r)?.knockout));
  const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
</script>

<div class="scroll">
  <table>
    <thead>
      <tr>
        {#if overall}<th>Team</th><th title="Gruppe">Gr.</th>{/if}
        <th class="num" title={overall ? 'Platz in der Gruppe' : 'Platz'}>Pl</th>
        {#if !overall}<th>Team</th>{/if}
        <th class="num" title="Spiele">Sp</th><th class="num" title="Siege">S</th>
        {#if simple}<th class="num" title="Unentschieden">U</th>{/if}<th class="num" title="Niederlagen">N</th>
        {#if !simple}<th class="num">Sätze</th><th class="num" title="Ballpunkte">Bälle</th>{/if}
        <th class="num" title={overall ? 'Tabellenpunkte der Gruppe' : 'Tabellenpunkte'}>Pkt</th>
        {#if knockout}<th>KO-Runde</th>{/if}
      </tr>
    </thead>
    <tbody>
      {#each rows as row, i (row.teamId)}
        {@const s = stats(row)}
        <tr class:qualifies={i < qualify}>
          {#snippet team()}
            <td class="team"
              >{row.name}{#if own(row.teamId)}&nbsp;<Tag tone="blue">Eigenes Team</Tag>{/if}</td
            >
          {/snippet}
          {#if overall}{@render team()}<td>{s?.group ?? '–'}</td>{/if}
          <td class="num">{overall ? (s?.rank ?? '–') : i + 1}</td>
          {#if !overall}{@render team()}{/if}
          <td class="num">{row.played}</td><td class="num">{row.won}</td>
          {#if simple}<td class="num">{row.drawn}</td>{/if}<td class="num">{row.lost}</td>
          {#if !simple}
            <td class="num" title="Differenz {signed(row.setsWon - row.setsLost)}">{row.setsWon}:{row.setsLost}</td>
            <td class="num" title="Differenz {signed(row.ballsWon - row.ballsLost)}">{row.ballsWon}:{row.ballsLost}</td>
          {/if}
          <td class="num points">{row.points ?? '–'}</td>
          {#if knockout}<td class="ko" class:winner={s?.knockout === 'Sieger'}>{s?.knockout ?? ''}</td>{/if}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .scroll {
    overflow-x: auto;
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
    white-space: nowrap;
  }
  th,
  td {
    padding: var(--space-xs);
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
  .ko {
    white-space: nowrap;
  }
  .ko.winner {
    font-weight: var(--font-weight-bold);
    color: var(--color-accent);
  }
</style>
