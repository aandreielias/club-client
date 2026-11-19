<script lang="ts">
  import EditorForm from '../../ui/EditorForm.svelte';
  import { MeetingPlaceForm } from './MeetingForm.svelte';
  import type { MeetingModel } from './MeetingModel.svelte';
  import MeetingPlaceFields from './MeetingPlaceFields.svelte';
  import type { Meeting } from './model';

  /** Changing the place of a meeting, until it closes. */
  let { meeting, model, onclose }: { meeting: Meeting; model: MeetingModel; onclose: () => void } = $props();

  // svelte-ignore state_referenced_locally
  const form = MeetingPlaceForm.of(meeting);

  async function submit() {
    if (await model.savePlace(form.toPatch())) onclose();
  }
</script>

<EditorForm action={model.action} submitLabel="Speichern" validate={form} onsubmit={submit} oncancel={onclose}>
  <MeetingPlaceFields bind:location={form.location} online={meeting.online} />
</EditorForm>
