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
  import { ADMIN_BOARD } from '../../lib/types';

  const pinLength = settings.security.pinLength;
  const policy = new PasswordPolicy(settings.auth.passwordMinLength);
  const security = new Resource(() => session.security());
  void security.load();

  const canSetClubPin = session.hasRole(...ADMIN_BOARD);
  const pinAction = new Action();
  let newPin = $state('');
  let repeatPin = $state('');
  let pinMismatch = $state(false);

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

  async function changeClubPin(event: SubmitEvent) {
    event.preventDefault();
    pinMismatch = newPin !== repeatPin;
    if (pinMismatch) return;
    if (await pinAction.run(() => session.setClubPin(newPin))) {
      newPin = repeatPin = '';
      bus.publish(TOAST, { text: 'Vereins-PIN gespeichert.' });
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
  <h3>Vereins-PIN</h3>
  <AsyncView resource={security}>
    {#snippet children(status)}
      <div class="stack">
        {#if !status.clubPinSet}
          {#if canSetClubPin}
            <p>Es gibt noch keinen Vereins-PIN. Lege ihn fest und gib ihn persönlich an Admin, Vorstand und Trainer:innen weiter.</p>
          {:else if session.isPrivileged}
            <p class="muted">Noch kein Vereins-PIN – frag den Vorstand.</p>
          {/if}
        {:else if session.isPrivileged}
          <div class="row">
            {#if status.stepUpUntil}
              <Tag tone="green">Bestätigt bis {session.format.time(status.stepUpUntil)}</Tag>
            {:else}
              <span class="muted">Änderungen mit erweiterten Rechten brauchen eine Bestätigung mit dem Vereins-PIN.</span>
              <Button size="sm" onclick={confirmNow}>Jetzt bestätigen</Button>
            {/if}
          </div>
        {/if}
        {#if status.pinLocked}<p class="danger" role="alert">Der Vereins-PIN ist für dich gesperrt. Ein Admin muss die Sperre aufheben.</p>{/if}

        {#if canSetClubPin}
          <form class="stack readable" onsubmit={changeClubPin}>
            {#if status.clubPinChangedAt}
              <p class="muted">Zuletzt geändert am {session.format.dateTime(status.clubPinChangedAt)}.</p>
            {/if}
            <div class="grid-2">
              <Field label="Neuer Vereins-PIN" hint="{pinLength} Buchstaben oder Ziffern">
                <input type="password" bind:value={newPin} minlength={pinLength} maxlength={pinLength} autocomplete="off" required />
              </Field>
              <Field label="Neuen Vereins-PIN wiederholen" error={pinMismatch ? 'Die PINs stimmen nicht überein.' : null}>
                <input type="password" bind:value={repeatPin} minlength={pinLength} maxlength={pinLength} autocomplete="off" required />
              </Field>
            </div>
            <ErrorNote error={pinAction.error} />
            <div>
              <Button type="submit" busy={pinAction.busy}>{status.clubPinSet ? 'Vereins-PIN ändern' : 'Vereins-PIN festlegen'}</Button>
            </div>
          </form>
        {/if}
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
  p {
    margin: 0;
  }
  .danger {
    color: var(--color-danger);
  }
</style>
