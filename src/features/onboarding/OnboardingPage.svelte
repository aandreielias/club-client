<script lang="ts">
  import { session } from '../../lib/container';
  import { ZonedClock } from '../../lib/time/ZonedClock';
  import { Action } from '../../lib/state/Action.svelte';
  import Button from '../../ui/Button.svelte';
  import Centered from '../../ui/Centered.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import DateInput from '../../ui/DateInput.svelte';

  let { onlogout }: { onlogout: () => void } = $props();

  const action = new Action();
  // The server wants a date in the past (@Past): today is refused.
  const yesterday = ZonedClock.addDays(session.clock.today(), -1);

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
      <DateInput bind:value={birthDate} max={yesterday} required />
    </Field>
    <ErrorNote error={action.error} />
    <div class="row">
      <Button type="submit" variant="primary" busy={action.busy} tooltip="Speichern und zum nächsten Schritt">Weiter</Button>
      <Button variant="ghost" onclick={onlogout}>Abmelden</Button>
    </div>
  </form>
</Centered>
