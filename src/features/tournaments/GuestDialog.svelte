<script lang="ts">
  import { bus } from '../../lib/container';
  import { TOAST } from '../../channels';
  import Button from '../../ui/Button.svelte';
  import Dialog from '../../ui/Dialog.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
  import type { Tournament } from './model';
  import type { TournamentModel } from './TournamentModel.svelte';

  /** A temporary account for someone of a visiting team: invite mail, sees only this tournament. */
  let { tournament, model, onclose }: { tournament: Tournament; model: TournamentModel; onclose: () => void } = $props();

  let teamId = $state('');
  let email = $state('');
  let firstName = $state('');
  let lastName = $state('');
  let submitted = $state(false);
  const valid = $derived(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) && !!firstName.trim() && !!lastName.trim());

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    submitted = true;
    if (!valid) return;
    if (
      await model.inviteGuest({ teamId: teamId || null, email: email.trim().toLowerCase(), firstName: firstName.trim(), lastName: lastName.trim() })
    ) {
      bus.publish(TOAST, { text: 'Gastzugang angelegt, Einladung verschickt.' });
      onclose();
    }
  }
</script>

<Dialog open title="Gastzugang anlegen" {onclose}>
  <form class="stack" onsubmit={submit} novalidate>
    <Field label="Team">
      <Select
        bind:value={teamId}
        placeholder="Ohne Team"
        options={tournament.teams.filter((t) => !t.clubTeamId).map((t) => ({ value: t.id, label: t.name }))}
      />
    </Field>
    <Field label="E-Mail" error={submitted && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) ? 'Gültige E-Mail-Adresse angeben.' : null}>
      <input type="email" bind:value={email} autocomplete="off" required />
    </Field>
    <div class="grid-2">
      <Field label="Vorname" error={submitted && !firstName.trim() ? 'Vorname angeben.' : null}
        ><input bind:value={firstName} maxlength="100" /></Field
      >
      <Field label="Nachname" error={submitted && !lastName.trim() ? 'Nachname angeben.' : null}
        ><input bind:value={lastName} maxlength="100" /></Field
      >
    </div>
    <ErrorNote error={model.action.error} />
    <div class="row">
      <Button type="submit" variant="primary" busy={model.action.busy}>Zugang anlegen</Button>
      <Button variant="ghost" onclick={onclose}>Abbrechen</Button>
    </div>
  </form>
</Dialog>
