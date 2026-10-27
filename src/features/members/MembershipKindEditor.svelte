<script lang="ts">
  import type { Action } from '../../lib/state/Action.svelte';
  import { autofocus } from '../../ui/autofocus';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import type { MembershipKindInput } from './MembersApi';

  /** Form of a membership kind: name, voting in the general meeting, being elected into an office. */
  let {
    form,
    action,
    submitLabel,
    canArchive,
    oncancel,
    onsubmit,
  }: {
    form: MembershipKindInput;
    action: Action;
    submitLabel: string;
    canArchive: boolean;
    oncancel: () => void;
    onsubmit: () => void;
  } = $props();

  function submit(event: SubmitEvent) {
    event.preventDefault();
    onsubmit();
  }
</script>

<form class="stack" onsubmit={submit} {@attach autofocus}>
  <Field label="Bezeichnung">
    <input bind:value={form.label} maxlength="40" required />
  </Field>
  <label class="check"><input type="checkbox" bind:checked={form.votes} /> Stimmrecht in der Mitgliederversammlung</label>
  <label class="check"><input type="checkbox" bind:checked={form.eligible} /> Kann in eine Funktion gewählt werden</label>
  <Field label="Reihenfolge" hint="Kleinere Zahlen stehen weiter oben.">
    <input type="number" min="0" max="1000" bind:value={form.sort} class="short" />
  </Field>
  {#if canArchive}
    <label class="check"><input type="checkbox" bind:checked={form.archived} /> Archiviert (für weitere Mitglieder nicht mehr wählbar)</label>
  {/if}
  <ErrorNote error={action.error} />
  <div class="row">
    <Button type="submit" variant="primary" busy={action.busy}>{submitLabel}</Button>
    <Button variant="ghost" onclick={oncancel}>Abbrechen</Button>
  </div>
</form>

<style>
  .short {
    width: 6rem;
  }
</style>
