<script lang="ts">
  import { settings } from '../../settings';
  import { toasts } from '../../lib/container';
  import Button from '../../ui/Button.svelte';
  import ChoiceGroup from '../../ui/ChoiceGroup.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import type { AppointmentDetailModel } from './AppointmentDetailModel.svelte';
  import { RESPONSE_OPTIONS, type ResponseStatus } from './model';

  let { detail }: { detail: AppointmentDetailModel } = $props();

  // Initial values from the member's current answer; the form owns them afterwards.
  // svelte-ignore state_referenced_locally
  let status = $state<ResponseStatus | null>(detail.ownEntry?.status ?? null);
  // svelte-ignore state_referenced_locally
  let reason = $state(detail.ownEntry?.reason ?? '');

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (status && (await detail.respond(status, reason))) toasts.show('Antwort gespeichert.');
  }
</script>

<form class="stack" onsubmit={submit}>
  <ChoiceGroup name="response" label="Antwort" options={RESPONSE_OPTIONS} bind:value={status} />
  <Field label="Begründung (optional)" hint="Sehen nur Trainer:innen des Teams, Vorstand und Admins.">
    <input bind:value={reason} maxlength={settings.calendar.reasonMaxLength} />
  </Field>
  <ErrorNote error={detail.respondAction.error} />
  <div><Button type="submit" variant="primary" busy={detail.respondAction.busy} disabled={!status}>Antwort speichern</Button></div>
</form>
