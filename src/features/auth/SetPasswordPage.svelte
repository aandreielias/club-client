<script lang="ts">
  import { settings } from '../../settings';
  import { auth, bus } from '../../lib/container';
  import { NAVIGATE, TOAST } from '../../channels';
  import { Action } from '../../lib/state/Action.svelte';
  import Button from '../../ui/Button.svelte';
  import Centered from '../../ui/Centered.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import { PasswordPolicy } from '../../lib/auth/PasswordPolicy';

  // Opened from an invite or recovery mail.
  const policy = new PasswordPolicy(settings.auth.passwordMinLength);
  const action = new Action();
  let password = $state('');
  let repeat = $state('');
  let mismatch = $state(false);

  const weak = $derived(password.length > 0 && !policy.accepts(password));

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    mismatch = password !== repeat;
    if (weak || mismatch) return;
    if (await action.run(() => auth.updatePassword(password))) {
      bus.publish(TOAST, { text: 'Passwort gespeichert.' });
      bus.publish(NAVIGATE, { path: '/' });
    }
  }
</script>

<Centered title="Passwort festlegen">
  <form class="stack" onsubmit={submit}>
    <Field label="Neues Passwort" hint={policy.description} error={weak ? policy.description : null}>
      <input type="password" bind:value={password} autocomplete="new-password" required />
    </Field>
    <Field label="Wiederholen" error={mismatch ? 'Die Passwörter stimmen nicht überein.' : null}>
      <input type="password" bind:value={repeat} autocomplete="new-password" required />
    </Field>
    <ErrorNote error={action.error} />
    <div><Button type="submit" variant="primary" busy={action.busy}>Speichern</Button></div>
  </form>
</Centered>
