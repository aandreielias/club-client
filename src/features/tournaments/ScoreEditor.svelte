<script lang="ts">
  import Button from '../../ui/Button.svelte';
  import type { TournamentMatch } from './model';
  import type { TournamentModel } from './TournamentModel.svelte';

  /** Two score fields and save; Enter saves, empty fields remove the result. */
  let { match, model, onsaved }: { match: TournamentMatch; model: TournamentModel; onsaved?: () => void } = $props();

  // Number inputs: an empty field binds as null (or undefined).
  // svelte-ignore state_referenced_locally
  let home = $state<number | null>(match.homeScore);
  // svelte-ignore state_referenced_locally
  let away = $state<number | null>(match.awayScore);
  const score = (v: number | null | undefined) => (v === null || v === undefined || Number.isNaN(v) ? null : v);
  const changed = $derived(score(home) !== match.homeScore || score(away) !== match.awayScore);

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (await model.setResult(match.id, { homeScore: score(home), awayScore: score(away), startsAt: match.startsAt, field: match.field })) onsaved?.();
  }
</script>

<form class="score" onsubmit={save}>
  <input type="number" min="0" max="999" bind:value={home} aria-label="Tore {model.teamName(match.homeId) ?? 'Heim'}" />
  <span class="muted" aria-hidden="true">:</span>
  <input type="number" min="0" max="999" bind:value={away} aria-label="Tore {model.teamName(match.awayId) ?? 'Gast'}" />
  <Button type="submit" size="sm" variant={changed ? 'primary' : 'ghost'} icon="check" tooltip="Ergebnis speichern" disabled={!changed} busy={model.action.busy} />
</form>

<style>
  .score {
    display: inline-flex;
    align-items: center;
    gap: var(--space-xs);
  }
  /* Narrow score fields (the global field style makes inputs full width). */
  .score input[type='number'] {
    width: 3.2rem;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
</style>
