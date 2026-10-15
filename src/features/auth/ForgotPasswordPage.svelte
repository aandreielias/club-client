<script lang="ts">
  import { auth } from '../../lib/container';
  import { Action } from '../../lib/state/Action.svelte';
  import Button from '../../ui/Button.svelte';
  import Centered from '../../ui/Centered.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';

  const action = new Action();
  let email = $state('');
  let sent = $state(false);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    sent = await action.run(() => auth.resetPassword(email));
  }
</script>

<Centered title="Passwort vergessen">
  {#if sent}
    <p>Wenn es zu dieser Adresse ein Konto gibt, kommt gleich eine E-Mail mit einem Link.</p>
  {:else}
    <form class="stack" onsubmit={submit}>
      <Field label="E-Mail">
        <input type="email" bind:value={email} autocomplete="username" required />
      </Field>
      <ErrorNote error={action.error} />
      <div><Button type="submit" variant="primary" busy={action.busy}>Link senden</Button></div>
    </form>
  {/if}
  <p><a href="#/" class="muted">Zurück zur Anmeldung</a></p>
</Centered>
