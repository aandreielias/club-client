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
  let dev = $state.raw<{ accounts: DevAccount[] } | null>(null);
  if (settings.runtime.apiMode === 'mock') {
    import('../../lib/mock/core').then(({ directory }) => {
      dev = { accounts: directory.accounts() };
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
</Centered>

{#if dev}
  <aside class="dev" aria-labelledby="dev-title">
    <header><h2 id="dev-title">Testkonten</h2></header>
    <div class="body stack">
      <p class="muted">Testmodus ohne Server. Anmelden als:</p>
      <ul class="stack">
        {#each dev.accounts as account (account.email)}
          <li>
            <Button variant="ghost" onclick={() => signInAs(account)} tooltip="Als {account.name} anmelden ({account.email})">
              {account.name}
              <span class="muted">· {account.roles.map((r) => ROLE_LABELS[r]).join(', ')}</span>
            </Button>
          </li>
        {/each}
      </ul>
    </div>
  </aside>
{/if}

<style>
  /* Docked on the right like a detail window, so the login card stays centred. */
  .dev {
    position: fixed;
    top: var(--space-lg);
    right: var(--space-lg);
    bottom: var(--space-lg);
    display: flex;
    flex-direction: column;
    width: 300px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    background: var(--color-elevated);
    box-shadow: var(--color-shadow-window);
    font-size: var(--font-size-small);
  }
  .dev header {
    padding: var(--space-md) var(--space-lg);
    border-bottom: 1px solid var(--color-border);
  }
  .dev h2 {
    margin: 0;
    font-size: var(--font-size-base);
  }
  .body {
    overflow: auto;
    padding: var(--space-md) var(--space-lg);
  }
  .dev p {
    margin: 0;
  }
  .dev ul {
    gap: 0;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  /* Narrow screens: below the card instead of over it. */
  @media (max-width: 1000px) {
    .dev {
      position: static;
      width: auto;
      margin: 0 var(--space-lg) var(--space-lg);
    }
  }
</style>
