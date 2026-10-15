<script lang="ts">
  import { settings } from '../../settings';
  import { Action } from '../../lib/state/Action.svelte';
  import Button from '../../ui/Button.svelte';
  import Dialog from '../../ui/Dialog.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import { membersApi } from './services';

  /** Resetting every PIN is drastic; the exact confirmation text must be typed (also checked by the server). */
  let { ondone, onclose }: { ondone: (pinsReset: number) => void; onclose: () => void } = $props();

  const phrase = settings.members.resetAllConfirmation;
  const action = new Action();
  let typed = $state('');

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    let count = 0;
    if (await action.run(async () => (count = await membersApi.resetAllSecurity(typed)))) ondone(count);
  }
</script>

<Dialog open title="Alle PINs zurücksetzen" {onclose}>
  <form class="stack" onsubmit={submit}>
    <p>
      Alle Mitglieder mit erweiterten Rechten müssen danach eine neue PIN festlegen, auch du. Alle Bestätigungen werden
      beendet. Gedacht für den Fall, dass PINs bekannt geworden sein könnten.
    </p>
    <Field label="Zur Bestätigung „{phrase}“ eingeben">
      <input bind:value={typed} autocomplete="off" spellcheck="false" />
    </Field>
    <ErrorNote error={action.error} />
    <div class="row">
      <Button type="submit" variant="danger" busy={action.busy} disabled={typed !== phrase}>Alle PINs zurücksetzen</Button>
      <Button variant="ghost" onclick={onclose}>Abbrechen</Button>
    </div>
  </form>
</Dialog>
