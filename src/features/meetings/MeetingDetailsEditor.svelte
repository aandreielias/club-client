<script lang="ts">
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import { MeetingPlaceForm } from './MeetingForm.svelte';
  import type { MeetingModel } from './MeetingModel.svelte';
  import MeetingPlaceFields from './MeetingPlaceFields.svelte';
  import type { Meeting } from './model';

  /** Changing place and online participation of a meeting, until it closes. */
  let { meeting, model, onclose }: { meeting: Meeting; model: MeetingModel; onclose: () => void } = $props();

  // svelte-ignore state_referenced_locally
  const form = MeetingPlaceForm.of(meeting);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    form.submitted = true;
    if (form.valid && (await model.savePlace(form.toPatch()))) onclose();
  }
</script>

<form class="stack editor" onsubmit={submit} novalidate>
  <MeetingPlaceFields bind:location={form.location} bind:online={form.online} bind:videoUrl={form.videoUrl} error={form.error('videoUrl')} />
  <ErrorNote error={model.action.error} />
  <div class="row">
    <Button type="submit" variant="primary" busy={model.action.busy}>Speichern</Button>
    <Button variant="ghost" onclick={onclose}>Abbrechen</Button>
  </div>
</form>

<style>
  .editor {
    padding: var(--space-md);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
  }
</style>
