<script lang="ts">
  import { settings } from '../../settings';
  import { session } from '../../lib/container';
  import { Action } from '../../lib/state/Action.svelte';
  import Button from '../../ui/Button.svelte';
  import Centered from '../../ui/Centered.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';

  let { onlogout }: { onlogout: () => void } = $props();

  const pinLength = settings.security.pinLength;
  const action = new Action();

  // The server lists what is missing in order: birth date first, then the PIN.
  const step = $derived(session.me?.missing[0]);
  const today = session.clock.today();

  let birthDate = $state('');
  let pin = $state('');
  let repeat = $state('');
  let mismatch = $state(false);

  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (step === 'birthDate') return action.run(() => session.updateProfile({ birthDate }));
    mismatch = pin !== repeat;
    if (!mismatch) return action.run(() => session.setPin(pin));
  }
</script>

<Centered title={step === 'birthDate' ? 'Geburtsdatum' : 'PIN festlegen'} subtitle="Willkommen, {session.member.firstName}">
  <form class="stack" onsubmit={submit}>
    {#if step === 'birthDate'}
      <p class="muted">
        Wird für Altersklassen und Einverständnisse gebraucht. Sichtbar nur für dich, deine Erziehungsberechtigten, deine
        Trainer:innen und Admins.
      </p>
      <Field label="Geburtsdatum">
        <input type="date" bind:value={birthDate} max={today} required />
      </Field>
    {:else}
      <p class="muted">
        Mit der PIN bestätigst du wichtige Änderungen. {pinLength} Buchstaben oder Ziffern, keine einfachen Folgen.
      </p>
      <Field label="PIN">
        <input type="password" bind:value={pin} minlength={pinLength} maxlength={pinLength} autocomplete="off" required />
      </Field>
      <Field label="PIN wiederholen" error={mismatch ? 'Die PINs stimmen nicht überein.' : null}>
        <input type="password" bind:value={repeat} minlength={pinLength} maxlength={pinLength} autocomplete="off" required />
      </Field>
    {/if}
    <ErrorNote error={action.error} />
    <div class="row">
      <Button type="submit" variant="primary" busy={action.busy} tooltip="Speichern und zum nächsten Schritt">Weiter</Button>
      <Button variant="ghost" onclick={onlogout}>Abmelden</Button>
    </div>
  </form>
</Centered>
