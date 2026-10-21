<script lang="ts">
  import Empty from '../../ui/Empty.svelte';
  import Icon from '../../ui/Icon.svelte';
  import { tooltip } from '../../ui/tooltip';
  import { roundName } from './logic';
  import { matchPlace, type Tournament, type TournamentMatch } from './model';
  import ResultDialog from './ResultDialog.svelte';
  import { TournamentModel } from './TournamentModel.svelte';
  import { tournamentPolicy as policy } from './services';

  /** The knockout tree: one column per round, lines joining each pair of matches to the next. */
  let { tournament, model }: { tournament: Tournament; model: TournamentModel } = $props();

  const ko = $derived(tournament.matches.filter((m) => m.stage === 'KO'));
  const rounds = $derived(Math.max(0, ...ko.map((m) => m.round)));
  const inRound = (round: number) => ko.filter((m) => m.round === round).sort((a, b) => a.slot - b.slot);
  let editing = $state<TournamentMatch | null>(null);

  const editable = (m: TournamentMatch) => policy.canManage() && tournament.status !== 'DRAFT' && !!m.homeId && !!m.awayId;
  const teamLabel = (m: TournamentMatch, teamId: string | null, other: string | null) =>
    model.teamName(teamId) ?? (m.round === 1 && other ? 'Freilos' : 'offen');
</script>

{#if !ko.length}
  <Empty text={tournament.status === 'GROUPS' ? 'Die KO-Runde startet, wenn alle Gruppenspiele gespielt sind.' : 'Noch keine KO-Runde.'} />
{:else}
  <div class="bracket" style:--rounds={rounds}>
    {#each Array.from({ length: rounds }, (_, i) => i + 1) as round (round)}
      <section class="round" class:last={round === rounds}>
        <h3>{roundName(round, rounds)}</h3>
        <div class="slots">
          {#each inRound(round) as m, i (m.id)}
            {@const winner = TournamentModel.winner(m)}
            <div class="slot" class:upper={i % 2 === 0}>
              <button type="button" class="match" class:played={m.homeScore !== null} disabled={!editable(m)} onclick={() => (editing = m)}
                {@attach tooltip(editable(m) ? 'Ergebnis eintragen' : null)}>
                {#each [[m.homeId, m.awayId, m.homeScore], [m.awayId, m.homeId, m.awayScore]] as [team, other, score], side (side)}
                  <span class="line" class:winner={!!winner && winner === team} class:open={!team}>
                    <span class="name">{teamLabel(m, team as string | null, other as string | null)}</span>
                    <span class="score">{score ?? ''}</span>
                  </span>
                {/each}
                {#if m.sets.length || m.field || m.wave}
                  <span class="meta">{[m.sets.map((s) => `${s.home}:${s.away}`).join(' · '), matchPlace(m)].filter(Boolean).join(' – ')}</span>
                {/if}
              </button>
            </div>
          {/each}
        </div>
      </section>
    {/each}
    {#if model.champion}
      <section class="round champion">
        <h3>Sieger</h3>
        <div class="slots"><div class="slot"><div class="winner-card"><Icon name="trophy" /> {model.champion}</div></div></div>
      </section>
    {/if}
  </div>
{/if}

{#if editing}<ResultDialog match={editing} {model} onclose={() => (editing = null)} />{/if}

<style>
  /* Columns of rounds; slots share the column height evenly, so a match sits exactly between the two it follows. */
  .bracket {
    --gap: var(--space-xxl);
    --line: var(--color-border-strong);
    display: grid;
    grid-auto-columns: minmax(12rem, 1fr);
    grid-auto-flow: column;
    column-gap: var(--gap);
    overflow-x: auto;
    padding-bottom: var(--space-md);
  }
  .round {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  h3 {
    margin: 0 0 var(--space-sm);
    color: var(--color-text-muted);
    font-size: var(--font-size-small);
    font-weight: var(--font-weight-medium);
  }
  .slots {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: calc(var(--rounds) * 4.5rem);
  }
  .slot {
    position: relative;
    display: flex;
    flex: 1;
    align-items: center;
    padding: var(--space-xs) 0;
  }
  /* Connectors: a stub to the right of every match, a vertical joint per pair, a stub into the next match. */
  .round:not(.last):not(.champion) .slot::after {
    position: absolute;
    right: calc(var(--gap) / -2);
    width: calc(var(--gap) / 2);
    border-top: 1px solid var(--line);
    top: 50%;
    content: '';
  }
  .round:not(.last):not(.champion) .slot::before {
    position: absolute;
    right: calc(var(--gap) / -2);
    border-right: 1px solid var(--line);
    content: '';
  }
  .round:not(.last):not(.champion) .slot.upper::before {
    top: 50%;
    bottom: 0;
  }
  .round:not(.last):not(.champion) .slot:not(.upper)::before {
    top: 0;
    bottom: 50%;
  }
  .round:not(:first-child) .match::before,
  .champion .winner-card::before {
    position: absolute;
    left: calc(var(--gap) / -2 - 1px);
    width: calc(var(--gap) / 2);
    border-top: 1px solid var(--line);
    top: 50%;
    content: '';
  }
  .match {
    position: relative;
    display: grid;
    width: 100%;
    padding: 0;
    overflow: visible;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: inherit;
    font: inherit;
    text-align: left;
    transition: border-color var(--motion-fast) var(--motion-easing), box-shadow var(--motion-fast) var(--motion-easing);
  }
  .match:not(:disabled) {
    cursor: pointer;
  }
  .match:not(:disabled):hover {
    border-color: var(--color-accent);
    box-shadow: var(--color-shadow-raised);
  }
  .line {
    display: flex;
    justify-content: space-between;
    gap: var(--space-sm);
    padding: var(--space-xs) var(--space-sm);
  }
  .line + .line {
    border-top: 1px solid var(--color-border);
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .score {
    font-variant-numeric: tabular-nums;
  }
  .winner {
    font-weight: var(--font-weight-bold);
  }
  .winner .score {
    color: var(--color-accent);
  }
  .open {
    color: var(--color-text-faint);
    font-style: italic;
  }
  .meta {
    padding: 0 var(--space-sm) var(--space-xxs);
    color: var(--color-text-faint);
    font-size: var(--font-size-small);
  }
  .winner-card {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: var(--space-sm);
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    border: 1px solid var(--color-accent);
    border-radius: var(--radius-md);
    background: var(--color-accent-soft);
    color: var(--color-accent);
    font-weight: var(--font-weight-bold);
  }
</style>
