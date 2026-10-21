<script lang="ts">
  import { bus } from '../../lib/container';
  import { TOAST } from '../../channels';
  import Button from '../../ui/Button.svelte';
  import Dialog from '../../ui/Dialog.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import type { Tournament } from './model';
  import TournamentFields from './TournamentFields.svelte';
  import { TournamentForm } from './TournamentForm.svelte';
  import type { TournamentModel } from './TournamentModel.svelte';

  /** Edits name, days and place; before the draw also groups, fields and format. */
  let { tournament, model, onclose }: { tournament: Tournament; model: TournamentModel; onclose: () => void } = $props();

  // svelte-ignore state_referenced_locally
  const form = TournamentForm.from(tournament);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    form.submitted = true;
    if (!form.valid) return;
    const patch = form.toPatch();
    if (!Object.keys(patch).length) return onclose();
    if (await model.update(patch)) {
      bus.publish(TOAST, { text: 'Turnier gespeichert.' });
      onclose();
    }
  }
</script>

<Dialog open title="Turnier bearbeiten" {onclose}>
  <form class="stack" onsubmit={submit} novalidate>
    <TournamentFields {form} />
    <ErrorNote error={model.action.error} />
    <div class="row">
      <Button type="submit" variant="primary" busy={model.action.busy}>Speichern</Button>
      <Button variant="ghost" onclick={onclose}>Abbrechen</Button>
    </div>
  </form>
</Dialog>
