<script lang="ts">
  import Button from '../../ui/Button.svelte';
  import Dialog from '../../ui/Dialog.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import type { AppointmentDetailModel } from './AppointmentDetailModel.svelte';
  import type { Appointment } from './model';

  let {
    open = $bindable(),
    detail,
    appointment,
    oncancelled,
  }: { open: boolean; detail: AppointmentDetailModel; appointment: Appointment; oncancelled: () => void } = $props();

  let includeFollowing = $state(false);

  async function confirm() {
    if (await detail.cancel(includeFollowing)) {
      open = false;
      oncancelled();
    }
  }
</script>

<Dialog {open} title="Termin absagen" onclose={() => (open = false)}>
  <div class="stack">
    <p>„{appointment.title}“ wird abgesagt. Alle, die den Termin sehen, werden benachrichtigt.</p>
    {#if appointment.seriesId}
      <label class="check">
        <input type="checkbox" bind:checked={includeFollowing} />
        Auch alle folgenden Termine dieser Serie absagen
      </label>
    {/if}
    <ErrorNote error={detail.cancelAction.error} />
    <div class="row">
      <Button variant="danger" busy={detail.cancelAction.busy} onclick={confirm}>Absagen</Button>
      <Button variant="ghost" onclick={() => (open = false)}>Abbrechen</Button>
    </div>
  </div>
</Dialog>
