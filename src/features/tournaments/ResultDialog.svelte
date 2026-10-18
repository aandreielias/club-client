<script lang="ts">
  import { session } from '../../lib/container';
  import Button from '../../ui/Button.svelte';
  import ChoiceGroup from '../../ui/ChoiceGroup.svelte';
  import Dialog from '../../ui/Dialog.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import { setsProblem, setTarget, tally } from './logic';
  import type { Outcome, TournamentMatch } from './model';
  import type { TournamentModel } from './TournamentModel.svelte';

  /**
   * The result of a match, plus kick-off and field. Volleyball and beach: the points of every set by the rules (no sets =
   * no result); simple: only who won, in the groups also a draw.
   */
  let { match, model, onclose }: { match: TournamentMatch; model: TournamentModel; onclose: () => void } = $props();

  // svelte-ignore state_referenced_locally
  const setsToWin = model.tournament.value?.setsToWin ?? 2;
  // svelte-ignore state_referenced_locally
  const format = model.tournament.value?.format ?? 'VOLLEYBALL';
  const simple = format === 'SIMPLE';
  // svelte-ignore state_referenced_locally
  let outcome = $state<Outcome | null>(
    !simple || match.homeScore === null ? null : match.homeScore > match.awayScore! ? 'HOME' : match.awayScore! > match.homeScore ? 'AWAY' : 'DRAW',
  );
  // svelte-ignore state_referenced_locally
  const outcomes: { value: Outcome; label: string }[] = [
    { value: 'HOME', label: `Sieg ${model.teamName(match.homeId)}` },
    ...(match.stage === 'GROUP' ? [{ value: 'DRAW' as const, label: 'Unentschieden' }] : []),
    { value: 'AWAY', label: `Sieg ${model.teamName(match.awayId)}` },
  ];
  const maxSets = 2 * setsToWin - 1;
  // svelte-ignore state_referenced_locally
  let sets = $state<{ home: number | null; away: number | null }[]>(
    match.sets.length ? match.sets.map((s) => ({ ...s })) : Array.from({ length: setsToWin }, () => ({ home: null, away: null })),
  );
  // svelte-ignore state_referenced_locally
  let start = $state(match.startsAt ? session.clock.toLocal(match.startsAt) : '');
  // svelte-ignore state_referenced_locally
  let field = $state(match.field ?? '');

  const point = (v: number | null | undefined) => (v === null || v === undefined || Number.isNaN(v) ? null : v);
  /** Sets with both numbers; half-filled rows are an error, empty rows are ignored. */
  const filled = $derived(sets.filter((s) => point(s.home) !== null && point(s.away) !== null) as { home: number; away: number }[]);
  const half = $derived(sets.some((s) => (point(s.home) === null) !== (point(s.away) === null)));
  const won = $derived(tally(filled));
  const problem = $derived(simple ? null : setsProblem(filled, setsToWin, format));
  /** Open matches are no mistake yet: they only block saving. */
  const open = $derived(problem?.code === 'tournament.match-open');
  const error = $derived(
    half ? 'Bei jedem Satz beide Punkte eintragen.'
    : problem?.code === 'tournament.set-invalid' ? `Satz ${problem.set} geht bis ${setTarget(format, problem.set - 1, setsToWin)}, mit 2 Punkten Vorsprung.`
    : problem?.code === 'tournament.match-over' ? `Nach Satz ${problem.set} hat ein Team schon ${setsToWin} Sätze.`
    : null,
  );

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (error || open) return;
    const result = { sets: simple ? [] : filled, outcome: simple ? outcome : null, startsAt: start ? session.clock.toInstant(start) : null, field: field.trim() || null };
    if (await model.setResult(match.id, result)) onclose();
  }
</script>

<Dialog open title="{model.teamName(match.homeId)} – {model.teamName(match.awayId)}" {onclose}>
  <form class="stack" onsubmit={save}>
    {#if simple}
      <ChoiceGroup name="match-outcome" label="Ergebnis" options={outcomes} bind:value={outcome} />
      {#if outcome}<div><Button size="sm" variant="ghost" onclick={() => (outcome = null)}>Kein Ergebnis</Button></div>{/if}
    {:else}
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
        {#if sets.length < maxSets}<Button size="sm" icon="add" onclick={() => (sets = [...sets, { home: null, away: null }])}>Satz hinzufügen</Button>{:else}<span></span>{/if}
        <span class="muted">Sätze <strong class="won">{won.homeSets ?? 0}:{won.awaySets ?? 0}</strong></span>
      </div>
      {#if error}<p class="error" role="alert">{error}</p>
      {:else if open}<p class="muted note">Ein Team braucht {setsToWin} Gewinnsätze.</p>
      {:else}<p class="muted note">Sätze bis {format === 'BEACH' ? 21 : 25}, Entscheidungssatz bis 15, immer 2 Punkte Vorsprung.</p>{/if}
    {/if}
    <div class="grid-2">
      <Field label="Anpfiff (optional)"><input type="datetime-local" bind:value={start} /></Field>
      <Field label="Feld (optional)"><input bind:value={field} maxlength="40" placeholder="z. B. Feld 1" /></Field>
    </div>
    <ErrorNote error={model.action.error} />
    <div class="row">
      <Button type="submit" variant="primary" busy={model.action.busy} disabled={!!error || open}>Ergebnis speichern</Button>
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
  .note {
    margin: 0;
    font-size: var(--font-size-small);
  }
  .error {
    margin: 0;
    color: var(--color-danger);
    font-size: var(--font-size-small);
  }
</style>
