<script lang="ts">
  import { session } from '../../lib/container';
  import Button from '../../ui/Button.svelte';
  import Dialog from '../../ui/Dialog.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import type { TournamentMatch } from './model';
  import type { TournamentModel } from './TournamentModel.svelte';

  /** Result, kick-off and field of one match (knockout round). Empty scores remove the result. */
  let { match, model, onclose }: { match: TournamentMatch; model: TournamentModel; onclose: () => void } = $props();

  // svelte-ignore state_referenced_locally
  let home = $state<number | null>(match.homeScore);
  // svelte-ignore state_referenced_locally
  let away = $state<number | null>(match.awayScore);
  // svelte-ignore state_referenced_locally
  let start = $state(match.startsAt ? session.clock.toLocal(match.startsAt) : '');
  // svelte-ignore state_referenced_locally
  let field = $state(match.field ?? '');

  async function save(event: SubmitEvent) {
    event.preventDefault();
    const score = (v: number | null | undefined) => (v === null || v === undefined || Number.isNaN(v) ? null : v);
    const result = { homeScore: score(home), awayScore: score(away), startsAt: start ? session.clock.toInstant(start) : null, field: field.trim() || null };
    if (await model.setResult(match.id, result)) onclose();
  }
</script>

<Dialog open title="{model.teamName(match.homeId)} – {model.teamName(match.awayId)}" {onclose}>
  <form class="stack" onsubmit={save}>
    <div class="scores">
      <Field label={model.teamName(match.homeId) ?? 'Heim'}><input type="number" min="0" max="999" bind:value={home} /></Field>
      <span class="muted" aria-hidden="true">:</span>
      <Field label={model.teamName(match.awayId) ?? 'Gast'}><input type="number" min="0" max="999" bind:value={away} /></Field>
    </div>
    <div class="grid-2">
      <Field label="Anpfiff (optional)"><input type="datetime-local" bind:value={start} /></Field>
      <Field label="Platz (optional)"><input bind:value={field} maxlength="40" placeholder="z. B. Feld 1" /></Field>
    </div>
    <ErrorNote error={model.action.error} />
    <div class="row">
      <Button type="submit" variant="primary" busy={model.action.busy}>Speichern</Button>
      <Button variant="ghost" onclick={onclose}>Abbrechen</Button>
    </div>
  </form>
</Dialog>

<style>
  .scores {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: end;
    gap: var(--space-sm);
  }
  .scores span {
    padding-bottom: var(--space-sm);
  }
</style>
