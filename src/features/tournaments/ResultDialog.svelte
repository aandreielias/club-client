<script lang="ts">
  import { session } from '../../lib/container';
  import Button from '../../ui/Button.svelte';
  import Dialog from '../../ui/Dialog.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import { tally } from './logic';
  import type { TournamentMatch } from './model';
  import type { TournamentModel } from './TournamentModel.svelte';

  /** Volleyball result: the points of every set (up to five), plus kick-off and field. No sets = no result. */
  let { match, model, onclose }: { match: TournamentMatch; model: TournamentModel; onclose: () => void } = $props();

  const MAX_SETS = 5;
  // svelte-ignore state_referenced_locally
  let sets = $state<{ home: number | null; away: number | null }[]>(match.sets.length ? match.sets.map((s) => ({ ...s })) : [{ home: null, away: null }, { home: null, away: null }]);
  // svelte-ignore state_referenced_locally
  let start = $state(match.startsAt ? session.clock.toLocal(match.startsAt) : '');
  // svelte-ignore state_referenced_locally
  let field = $state(match.field ?? '');

  const point = (v: number | null | undefined) => (v === null || v === undefined || Number.isNaN(v) ? null : v);
  /** Sets with both numbers; half-filled rows are an error, empty rows are ignored. */
  const filled = $derived(sets.filter((s) => point(s.home) !== null && point(s.away) !== null) as { home: number; away: number }[]);
  const half = $derived(sets.some((s) => (point(s.home) === null) !== (point(s.away) === null)));
  const level = $derived(filled.some((s) => s.home === s.away));
  const won = $derived(tally(filled));
  const knockoutDraw = $derived(match.stage === 'KO' && filled.length > 0 && won.homeSets === won.awaySets);
  const error = $derived(half ? 'Bei jedem Satz beide Punkte eintragen.' : level ? 'Ein Satz endet nie unentschieden.' : knockoutDraw ? 'Ein KO-Spiel braucht einen Sieger.' : null);

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (error) return;
    const result = { sets: filled, startsAt: start ? session.clock.toInstant(start) : null, field: field.trim() || null };
    if (await model.setResult(match.id, result)) onclose();
  }
</script>

<Dialog open title="{model.teamName(match.homeId)} – {model.teamName(match.awayId)}" {onclose}>
  <form class="stack" onsubmit={save}>
    <div class="sets">
      <span></span>
      <span class="team">{model.teamName(match.homeId)}</span>
      <span></span>
      <span class="team">{model.teamName(match.awayId)}</span>
      <span></span>
      {#each sets as _, i (i)}
        <span class="muted label">Satz {i + 1}</span>
        <input type="number" min="0" max="99" bind:value={sets[i].home} aria-label="Satz {i + 1}, Punkte {model.teamName(match.homeId)}" />
        <span class="muted" aria-hidden="true">:</span>
        <input type="number" min="0" max="99" bind:value={sets[i].away} aria-label="Satz {i + 1}, Punkte {model.teamName(match.awayId)}" />
        <Button size="sm" variant="ghost" icon="close" tooltip="Satz entfernen" onclick={() => (sets = sets.filter((_, k) => k !== i))} />
      {/each}
    </div>
    <div class="row between">
      {#if sets.length < MAX_SETS}<Button size="sm" icon="add" onclick={() => (sets = [...sets, { home: null, away: null }])}>Satz hinzufügen</Button>{:else}<span></span>{/if}
      <span class="muted">Sätze <strong class="won">{won.homeSets ?? 0}:{won.awaySets ?? 0}</strong></span>
    </div>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <div class="grid-2">
      <Field label="Anpfiff (optional)"><input type="datetime-local" bind:value={start} /></Field>
      <Field label="Feld (optional)"><input bind:value={field} maxlength="40" placeholder="z. B. Feld 1" /></Field>
    </div>
    <ErrorNote error={model.action.error} />
    <div class="row">
      <Button type="submit" variant="primary" busy={model.action.busy} disabled={!!error}>Ergebnis speichern</Button>
      <Button variant="ghost" onclick={onclose}>Abbrechen</Button>
    </div>
  </form>
</Dialog>

<style>
  .sets {
    display: grid;
    grid-template-columns: 4rem minmax(0, 1fr) auto minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-xs) var(--space-sm);
  }
  .team {
    overflow: hidden;
    font-size: var(--font-size-small);
    font-weight: var(--font-weight-medium);
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .label {
    font-size: var(--font-size-small);
  }
  .sets input[type='number'] {
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  .between {
    justify-content: space-between;
    align-items: center;
  }
  .won {
    font-variant-numeric: tabular-nums;
  }
  .error {
    margin: 0;
    color: var(--color-danger);
    font-size: var(--font-size-small);
  }
</style>
