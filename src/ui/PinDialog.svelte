<script lang="ts">
  import { settings } from '../settings';
  import { stepUp } from '../lib/container';
  import { Action } from '../lib/state/Action.svelte';
  import Button from './Button.svelte';
  import Dialog from './Dialog.svelte';
  import ErrorNote from './ErrorNote.svelte';
  import Field from './Field.svelte';

  const length = settings.security.pinLength;
  const action = new Action();
  let pin = $state('');

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (await action.run(() => stepUp.confirm(pin))) pin = '';
  }

  function cancel() {
    pin = '';
    action.reset();
    stepUp.cancel();
  }
</script>

<Dialog open={stepUp.open} title="Mit PIN bestätigen" onclose={() => stepUp.open && cancel()}>
  <form class="stack" onsubmit={submit}>
    <p class="muted">Diese Änderung braucht eine Bestätigung. Sie gilt danach {settings.security.stepUpMinutes} Minuten.</p>
    <Field label="PIN">
      <!-- svelte-ignore a11y_autofocus -->
      <input type="password" bind:value={pin} minlength={length} maxlength={length} autocomplete="off" autofocus required />
    </Field>
    <ErrorNote error={action.error} />
    <div class="row">
      <Button type="submit" variant="primary" busy={action.busy}>Bestätigen</Button>
      <Button variant="ghost" onclick={cancel}>Abbrechen</Button>
    </div>
  </form>
</Dialog>
