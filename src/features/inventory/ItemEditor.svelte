<script lang="ts">
  import { autofocus } from '../../ui/autofocus';
  import { settings } from '../../settings';
  import type { Action } from '../../lib/state/Action.svelte';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import type { ItemForm } from './ItemForm.svelte';
  import Select from '../../ui/Select.svelte';
  import type { Location } from '../locations/model';
  import { locationsApi } from '../locations/services';

  let {
    form,
    action,
    submitLabel,
    categories = [],
    oncancel,
    onsubmit,
  }: { form: ItemForm; action: Action; submitLabel: string; categories?: readonly string[]; oncancel: () => void; onsubmit: () => void } =
    $props();

  const limits = settings.inventory;
  let places = $state<Location[]>([]);
  // svelte-ignore state_referenced_locally
  if (!form.original) locationsApi.list().then((list) => (places = list), () => {});
  const placeOptions = $derived([{ value: '', label: 'Ohne Ort' }, ...places.map((l) => ({ value: l.id, label: l.name }))]);

  function submit(event: SubmitEvent) {
    event.preventDefault();
    form.submitted = true;
    if (form.valid) onsubmit();
  }
</script>

<form class="stack" onsubmit={submit} novalidate {@attach autofocus}>
  <div class="grid-2">
    <Field label="Name" error={form.error('name')}>
      <input bind:value={form.name} maxlength={limits.nameMaxLength} required />
    </Field>
    <Field label="Kategorie (optional)" error={form.error('category')}>
      <input bind:value={form.category} maxlength={limits.categoryMaxLength} list="inventory-categories" />
    </Field>
  </div>
  {#if !form.original}
    <!-- Stock is split across places and people afterwards, under "Wo ist es?". -->
    <div class="grid-2">
      <Field label="Bestand" error={form.error('quantity')}>
        <input type="number" bind:value={form.quantity} min="0" max={limits.maxQuantity} required />
      </Field>
      <Field label="Wo (optional)" hint="Verteilen auf Orte und Personen geht danach unter „Wo ist es?“.">
        <Select bind:value={form.locationId} options={placeOptions} />
      </Field>
    </div>
  {/if}
  <datalist id="inventory-categories">
    {#each categories as category (category)}<option value={category}></option>{/each}
  </datalist>
  <Field label="Beschreibung (optional)" error={form.error('description')}>
    <textarea bind:value={form.description} rows="4" maxlength={limits.descriptionMaxLength}></textarea>
  </Field>

  <ErrorNote error={action.error} />
  <div class="row">
    <Button type="submit" variant="primary" busy={action.busy}>{submitLabel}</Button>
    <Button variant="ghost" onclick={oncancel}>Abbrechen</Button>
  </div>
</form>
