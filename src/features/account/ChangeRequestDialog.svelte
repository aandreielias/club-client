<script lang="ts">
  import { settings } from '../../settings';
  import { session } from '../../lib/container';
  import { ZonedClock } from '../../lib/time/ZonedClock';
  import Button from '../../ui/Button.svelte';
  import Dialog from '../../ui/Dialog.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import { autofocus } from '../../ui/autofocus';
  import { CHANGE_FIELD_LABELS, type ChangeField } from '../members/MembersApi';
  import type { OwnChangeRequests } from './OwnChangeRequests.svelte';

  /** Asks admin/board to change one account field; they decide in the task the request creates. */
  let { field = $bindable(), requests, onsent }: { field: ChangeField | null; requests: OwnChangeRequests; onsent: () => void } = $props();

  let value = $state('');
  let note = $state('');

  const label = $derived(field ? CHANGE_FIELD_LABELS[field] : '');
  const type = $derived(field === 'EMAIL' ? 'email' : field === 'BIRTH_DATE' ? 'date' : 'text');

  function close() {
    field = null;
    value = '';
    note = '';
    requests.sendAction.reset();
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (field && value.trim() && (await requests.send(field, value, note))) {
      close();
      onsent();
    }
  }
</script>

<Dialog open={field !== null} title="{label} ändern lassen" onclose={close}>
  <form class="stack" onsubmit={submit} {@attach autofocus}>
    <p class="muted">Der Vorstand bekommt die Anfrage als Aufgabe. Du wirst benachrichtigt, sobald entschieden ist.</p>
    <Field label="Neue Angabe: {label}">
      <input
        {type}
        bind:value
        required
        maxlength={type === 'text' ? settings.members.nameMaxLength : undefined}
        max={type === 'date' ? ZonedClock.addDays(session.clock.today(), -1) : undefined}
      />
    </Field>
    <Field label="Begründung (optional)">
      <textarea bind:value={note} rows="3" maxlength={settings.members.changeNoteMaxLength}></textarea>
    </Field>
    <ErrorNote error={requests.sendAction.error} />
    <div class="row">
      <Button type="submit" variant="primary" busy={requests.sendAction.busy} disabled={!value.trim()}>Anfrage senden</Button>
      <Button variant="ghost" onclick={close}>Abbrechen</Button>
    </div>
  </form>
</Dialog>
