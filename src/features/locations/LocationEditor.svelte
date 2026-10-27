<script lang="ts">
  import { autofocus } from '../../ui/autofocus';
  import { settings } from '../../settings';
  import { Action } from '../../lib/state/Action.svelte';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import type { LocationForm } from './LocationForm.svelte';
  import { locationsApi } from './services';

  let {
    form,
    action,
    submitLabel,
    oncancel,
    onsubmit,
  }: { form: LocationForm; action: Action; submitLabel: string; oncancel: () => void; onsubmit: () => void } = $props();

  const limits = settings.locations;
  const search = new Action();
  let searchNote = $state<string | null>(null);

  /** Map pin from the address (OpenStreetMap); the manager sees the match before saving. */
  async function locate() {
    searchNote = null;
    await search.run(async () => {
      const result = await locationsApi.geocode(form.address);
      if (result.found && result.lat !== null && result.lng !== null) {
        form.setPin(result.lat, result.lng);
        searchNote = result.label ? `Gefunden: ${result.label}` : 'Gefunden.';
      } else searchNote = 'Keine Übereinstimmung. Adresse prüfen oder Koordinaten von Hand eintragen.';
    });
  }

  function submit(event: SubmitEvent) {
    event.preventDefault();
    form.submitted = true;
    if (form.valid) onsubmit();
  }
</script>

<form class="stack" onsubmit={submit} novalidate {@attach autofocus}>
  <Field label="Name" hint="z. B. Turnhalle Nord" error={form.error('name')}>
    <input bind:value={form.name} maxlength={limits.nameMaxLength} required />
  </Field>
  <Field label="Straße und Hausnummer (optional)" error={form.error('street')}>
    <input bind:value={form.street} maxlength={limits.streetMaxLength} autocomplete="off" />
  </Field>
  <div class="town">
    <Field label="PLZ" error={form.error('zip')}>
      <input bind:value={form.zip} maxlength={limits.zipMaxLength} inputmode="numeric" autocomplete="off" />
    </Field>
    <Field label="Ort" error={form.error('city')}>
      <input bind:value={form.city} maxlength={limits.cityMaxLength} autocomplete="off" />
    </Field>
  </div>

  <fieldset class="stack pin">
    <legend>Kartenpunkt</legend>
    <div class="row">
      <Button size="sm" icon="search" busy={search.busy} disabled={!form.address} onclick={locate}>Auf der Karte suchen</Button>
      {#if form.pinned}<Button size="sm" variant="ghost" onclick={() => form.clearPin()}>Punkt entfernen</Button>{/if}
    </div>
    {#if searchNote}<p class="muted small" aria-live="polite">{searchNote}</p>{/if}
    <ErrorNote error={search.error} />
    <div class="grid-2">
      <Field label="Breite" error={form.error('coordinates')}><input bind:value={form.lat} inputmode="decimal" placeholder="48.208200" /></Field>
      <Field label="Länge"><input bind:value={form.lng} inputmode="decimal" placeholder="16.373800" /></Field>
    </div>
  </fieldset>

  <Field label="Hinweis (optional)" hint="z. B. Eingang, Parken, Schlüssel" error={form.error('note')}>
    <textarea bind:value={form.note} rows="3" maxlength={limits.noteMaxLength}></textarea>
  </Field>

  <ErrorNote error={action.error} />
  <div class="row">
    <Button type="submit" variant="primary" busy={action.busy}>{submitLabel}</Button>
    <Button variant="ghost" onclick={oncancel}>Abbrechen</Button>
  </div>
</form>

<style>
  .town {
    display: grid;
    grid-template-columns: 8rem minmax(0, 1fr);
    gap: var(--space-md);
  }
  .pin {
    margin: 0;
    padding: 0;
    border: 0;
  }
  legend {
    margin-bottom: var(--space-xs);
    font-size: var(--font-size-small);
    font-weight: var(--font-weight-medium);
  }
  .small {
    margin: 0;
    font-size: var(--font-size-small);
  }
</style>
