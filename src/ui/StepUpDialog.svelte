<script lang="ts">
  import { settings } from '../settings';
  import { stepUp } from '../lib/container';
  import { Action } from '../lib/state/Action.svelte';
  import Button from './Button.svelte';
  import Dialog from './Dialog.svelte';
  import ErrorNote from './ErrorNote.svelte';
  import Field from './Field.svelte';

  const pinLength = settings.security.pinLength;
  const codeLength = settings.security.totpCodeLength;
  const action = new Action();
  let secret = $state('');

  const title = $derived(
    stepUp.mode === 'pin'
      ? 'Mit Vereins-PIN bestätigen'
      : stepUp.mode === 'enroll'
        ? 'Authenticator-App einrichten'
        : 'Mit Authenticator-App bestätigen',
  );

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (await action.run(() => stepUp.confirm(secret))) secret = '';
  }

  function cancel() {
    secret = '';
    action.reset();
    stepUp.cancel();
  }
</script>

<Dialog open={stepUp.open} {title} onclose={() => stepUp.open && cancel()}>
  <form class="stack" onsubmit={submit}>
    {#if stepUp.failure}
      <ErrorNote error={stepUp.failure} />
    {:else if stepUp.mode === null}
      <p class="muted">Einen Moment …</p>
    {:else}
      {#if stepUp.mode === 'enroll' && stepUp.enrollment}
        <p>
          Admin und Vorstand bestätigen Änderungen mit einem Code aus einer Authenticator-App (z. B. Google Authenticator, Microsoft Authenticator,
          2FAS). Scanne den QR-Code mit der App und gib dann den angezeigten Code ein.
        </p>
        {#if stepUp.enrollment.qrCode}
          <img class="qr" src={'data:image/svg+xml;utf-8,' + encodeURIComponent(stepUp.enrollment.qrCode)} alt="QR-Code für die Authenticator-App" />
        {/if}
        <p class="muted">Oder diesen Schlüssel von Hand eingeben: <code>{stepUp.enrollment.secret}</code></p>
      {:else}
        <p class="muted">Diese Änderung braucht eine Bestätigung. Sie gilt danach {settings.security.stepUpMinutes} Minuten.</p>
      {/if}
      {#if stepUp.mode === 'pin'}
        <Field label="Vereins-PIN">
          <!-- svelte-ignore a11y_autofocus -->
          <input type="password" bind:value={secret} minlength={pinLength} maxlength={pinLength} autocomplete="off" autofocus required />
        </Field>
      {:else}
        <Field label="Code aus der Authenticator-App">
          <!-- svelte-ignore a11y_autofocus -->
          <input
            bind:value={secret}
            inputmode="numeric"
            pattern={`\\d{${codeLength}}`}
            minlength={codeLength}
            maxlength={codeLength}
            autocomplete="one-time-code"
            autofocus
            required
          />
        </Field>
      {/if}
      <ErrorNote error={action.error} />
    {/if}
    <div class="row">
      {#if stepUp.mode && !stepUp.failure}<Button type="submit" variant="primary" busy={action.busy}>Bestätigen</Button>{/if}
      <Button variant="ghost" onclick={cancel}>Abbrechen</Button>
    </div>
  </form>
</Dialog>

<style>
  p {
    margin: 0;
  }
  .qr {
    width: 12rem;
    height: 12rem;
    align-self: center;
    background: white;
  }
</style>
