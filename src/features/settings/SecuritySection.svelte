<script lang="ts">
  import { settings } from '../../settings';
  import { auth, bus } from '../../lib/container';
  import { TOAST } from '../../channels';
  import { PasswordPolicy } from '../../lib/auth/PasswordPolicy';
  import { Action } from '../../lib/state/Action.svelte';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';

  const policy = new PasswordPolicy(settings.auth.passwordMinLength);

  const passwordAction = new Action();
  let currentPassword = $state('');
  let newPassword = $state('');
  let repeatPassword = $state('');
  let passwordSubmitted = $state(false);
  const passwordError = $derived.by(() => {
    if (!passwordSubmitted) return null;
    if (!policy.accepts(newPassword)) return policy.description;
    if (newPassword !== repeatPassword) return 'Die Passwörter stimmen nicht überein.';
    return null;
  });

  async function changePassword(event: SubmitEvent) {
    event.preventDefault();
    passwordSubmitted = true;
    if (passwordError) return;
    if (await passwordAction.run(() => auth.changePassword(currentPassword, newPassword))) {
      currentPassword = newPassword = repeatPassword = '';
      passwordSubmitted = false;
      bus.publish(TOAST, { text: 'Passwort geändert.' });
    }
  }
</script>

<div class="stack">
  <form class="panel stack" onsubmit={changePassword} novalidate aria-label="Passwort">
    <header>
      <h2>Passwort</h2>
      <p class="muted small">Gilt für die Anmeldung in App und Website.</p>
    </header>
    <!-- Lets password managers pair the fields with the account. -->
    <input class="visually-hidden" type="email" autocomplete="username" value={auth.session?.email ?? ''} readonly tabindex="-1" aria-hidden="true" />
    <Field label="Aktuelles Passwort">
      <input type="password" bind:value={currentPassword} autocomplete="current-password" required />
    </Field>
    <div class="grid-2">
      <Field label="Neues Passwort" hint={policy.description}>
        <input type="password" bind:value={newPassword} autocomplete="new-password" required />
      </Field>
      <Field label="Neues Passwort wiederholen" error={passwordError}>
        <input type="password" bind:value={repeatPassword} autocomplete="new-password" required />
      </Field>
    </div>
    <ErrorNote error={passwordAction.error} />
    <div><Button type="submit" variant="primary" busy={passwordAction.busy}>Passwort ändern</Button></div>
  </form>
</div>
