<script lang="ts">
  import { session } from '../../lib/container';
  import { Action } from '../../lib/state/Action.svelte';
  import Button from '../../ui/Button.svelte';
  import Centered from '../../ui/Centered.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';

  let { onlogout }: { onlogout: () => void } = $props();

  const action = new Action();
  const today = session.clock.today();

  let birthDate = $state('');

  function submit(event: SubmitEvent) {
    event.preventDefault();
    return action.run(() => session.updateProfile({ birthDate }));
  }
</script>

<Centered title="Geburtsdatum" subtitle="Willkommen, {session.member.firstName}">
  <form class="stack" onsubmit={submit}>
    <p class="muted">
      Wird für Altersklassen und Einverständnisse gebraucht. Sichtbar nur für dich, deine Erziehungsberechtigten, deine
      Trainer:innen und Admins.
    </p>
    <Field label="Geburtsdatum">
      <input type="date" bind:value={birthDate} max={today} required />
    </Field>
    <ErrorNote error={action.error} />
    <div class="row">
      <Button type="submit" variant="primary" busy={action.busy} tooltip="Speichern und zum nächsten Schritt">Weiter</Button>
      <Button variant="ghost" onclick={onlogout}>Abmelden</Button>
    </div>
  </form>
</Centered>
