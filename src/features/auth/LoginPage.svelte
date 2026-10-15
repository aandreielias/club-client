<script lang="ts">
  import { settings } from '../../settings';
  import { auth, session } from '../../lib/container';
  import { Action } from '../../lib/state/Action.svelte';
  import { ROLE_LABELS } from '../../lib/types';
  import type { DevAccount } from '../../lib/mock/core';
  import Button from '../../ui/Button.svelte';
  import Centered from '../../ui/Centered.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';

  const action = new Action();
  let email = $state('');
  let password = $state('');

  // Mock mode only: seeded accounts to sign in with one click (loaded lazily, never in http builds).
  let dev = $state.raw<{ accounts: DevAccount[]; pin: string } | null>(null);
  if (settings.runtime.apiMode === 'mock') {
    import('../../lib/mock/core').then(({ directory, MockDirectory }) => {
      dev = { accounts: directory.accounts(), pin: MockDirectory.PIN };
    });
  }

  function submit(event?: SubmitEvent) {
    event?.preventDefault();
    return action.run(() => auth.signIn(email, password));
  }

  function signInAs(account: DevAccount) {
    email = account.email;
    password = 'dev';
    return submit();
  }
</script>

<Centered title="Anmelden" subtitle={session.club?.name}>
  <form class="stack" onsubmit={submit}>
    <Field label="E-Mail">
      <input type="email" bind:value={email} autocomplete="username" required />
    </Field>
    <Field label="Passwort">
      <input type="password" bind:value={password} autocomplete="current-password" required />
    </Field>
    <ErrorNote error={action.error} />
    <div class="row">
      <Button type="submit" variant="primary" busy={action.busy}>Anmelden</Button>
      <a href="#/forgot-password" class="muted">Passwort vergessen?</a>
    </div>
  </form>

  {#if dev}
    <section class="dev stack">
      <p class="muted">Testmodus ohne Server. Anmelden als:</p>
      <ul class="stack">
        {#each dev.accounts as account (account.email)}
          <li>
            <Button variant="ghost" onclick={() => signInAs(account)} tooltip="Als {account.name} anmelden ({account.email})">
              {account.name}
              <span class="muted">{account.roles.map((r) => ROLE_LABELS[r]).join(', ')}</span>
            </Button>
          </li>
        {/each}
      </ul>
      <p class="muted">PIN der Konten mit Admin-, Vorstand- oder Trainer-Rolle: <span class="mono">{dev.pin}</span></p>
    </section>
  {/if}
</Centered>

<style>
  .dev {
    margin-top: var(--space-xl);
    padding-top: var(--space-lg);
    border-top: 1px solid var(--color-border);
    font-size: var(--font-size-small);
  }
  .dev p {
    margin: 0;
  }
  .dev ul {
    gap: 0;
  }
</style>
