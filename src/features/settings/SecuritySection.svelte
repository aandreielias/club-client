<script lang="ts">
  import { settings } from '../../settings';
  import { auth, bus, session, stepUp } from '../../lib/container';
  import { TOAST } from '../../channels';
  import { PasswordPolicy } from '../../lib/auth/PasswordPolicy';
  import { Action } from '../../lib/state/Action.svelte';
  import { Resource } from '../../lib/state/Resource.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import Tag from '../../ui/Tag.svelte';

  const pinLength = settings.security.pinLength;
  const policy = new PasswordPolicy(settings.auth.passwordMinLength);
  const security = new Resource(() => session.security());
  void security.load();

  const pinAction = new Action();
  let currentPin = $state('');
  let newPin = $state('');

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

  async function changePin(event: SubmitEvent) {
    event.preventDefault();
    if (await pinAction.run(() => session.setPin(newPin, currentPin))) {
      currentPin = newPin = '';
      bus.publish(TOAST, { text: 'PIN gespeichert.' });
      void security.load();
    }
  }

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

  async function confirmNow() {
    if (await stepUp.request()) void security.load();
  }
</script>

<div class="stack section">
  <h3>Bestätigung mit PIN</h3>
  <AsyncView resource={security}>
    {#snippet children(status)}
      <div class="stack">
        {#if session.isPrivileged}
          <div class="row">
            {#if status.stepUpUntil}
              <Tag tone="green">Bestätigt bis {session.format.time(status.stepUpUntil)}</Tag>
            {:else}
              <span class="muted">Änderungen mit erweiterten Rechten brauchen eine Bestätigung per PIN.</span>
              <Button size="sm" onclick={confirmNow}>Jetzt bestätigen</Button>
            {/if}
          </div>
        {/if}
        {#if status.pinLocked}<p class="danger" role="alert">PIN gesperrt. Ein Admin muss sie zurücksetzen.</p>{/if}

        <form class="stack readable" onsubmit={changePin}>
          <div class="grid-2">
            {#if status.pinSet}
              <Field label="Aktuelle PIN">
                <input type="password" bind:value={currentPin} maxlength={pinLength} autocomplete="off" required />
              </Field>
            {/if}
            <Field label={status.pinSet ? 'Neue PIN' : 'PIN festlegen'} hint="{pinLength} Buchstaben oder Ziffern">
              <input type="password" bind:value={newPin} minlength={pinLength} maxlength={pinLength} autocomplete="off" required />
            </Field>
          </div>
          <ErrorNote error={pinAction.error} />
          <div><Button type="submit" busy={pinAction.busy}>{status.pinSet ? 'PIN ändern' : 'PIN speichern'}</Button></div>
        </form>
      </div>
    {/snippet}
  </AsyncView>

  <h3>Passwort</h3>
  <form class="stack readable" onsubmit={changePassword} novalidate>
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
    <div><Button type="submit" busy={passwordAction.busy}>Passwort ändern</Button></div>
  </form>
</div>

<style>
  h3 {
    margin: var(--space-sm) 0 0;
  }
  .danger {
    margin: 0;
    color: var(--color-danger);
  }
</style>
