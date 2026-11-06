<script lang="ts">
  import { session } from '../../lib/container';
  import { Resource } from '../../lib/state/Resource.svelte';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import AgendaItemsEditor from './AgendaItemsEditor.svelte';
  import { agendaError, rowsOf, toInputs, type AgendaRow } from './agenda';
  import type { MeetingModel } from './MeetingModel.svelte';
  import { majorities, type Meeting, type Resolution } from './model';
  import { activePeople } from './people';
  import { meetingTypes } from './services';

  /** The Tagesordnung with its Beschlüsse, saved together; voted Beschlüsse stay as they are. */
  let { meeting, model, resolutions, onclose }: { meeting: Meeting; model: MeetingModel; resolutions: readonly Resolution[]; onclose: () => void } =
    $props();

  // svelte-ignore state_referenced_locally
  let rows = $state<AgendaRow[]>(rowsOf(meeting, resolutions));
  let submitted = $state(false);
  const error = $derived(submitted ? agendaError(rows) : null);
  const people = new Resource(activePeople);
  void people.load();

  async function save() {
    submitted = true;
    if (agendaError(rows)) return;
    if (await model.setAgenda(toInputs(rows))) onclose();
  }
</script>

<div class="stack editor">
  <AgendaItemsEditor
    bind:rows
    majorities={majorities(meetingTypes.get(meeting.kind) ?? null)}
    candidates={people.value ?? []}
    today={session.clock.today()}
  />
  {#if error}<p class="invalid" role="alert">{error}</p>{/if}
  {#if meeting.status !== 'DRAFT'}
    <p class="muted small">Nach der Einladung erfahren alle Eingeladenen, dass sich die Tagesordnung geändert hat.</p>
  {/if}
  <ErrorNote error={model.action.error} />
  <div class="row">
    <Button variant="primary" busy={model.action.busy} onclick={save}>Tagesordnung speichern</Button>
    <Button variant="ghost" onclick={onclose}>Abbrechen</Button>
  </div>
</div>

<style>
  .editor {
    padding: var(--space-md);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
  }
  p {
    margin: 0;
  }
</style>
