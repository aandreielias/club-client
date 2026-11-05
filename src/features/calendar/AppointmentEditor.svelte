<script lang="ts">
  import EditorForm from '../../ui/EditorForm.svelte';
  import { settings } from '../../settings';
  import type { Action } from '../../lib/state/Action.svelte';
  import Field from '../../ui/Field.svelte';
  import DateInput from '../../ui/DateInput.svelte';
  import DateTimeInput from '../../ui/DateTimeInput.svelte';
  import Select from '../../ui/Select.svelte';
  import { CLUB_WIDE, type AppointmentForm } from './AppointmentForm.svelte';
  import { appointmentTypes } from './services';
  import { appointmentPolicy as policy } from './services';
  import type { Location } from '../locations/model';
  import { locationsApi } from '../locations/services';

  let {
    form,
    action,
    submitLabel,
    oncancel,
    onsubmit,
  }: { form: AppointmentForm; action: Action; submitLabel: string; oncancel: () => void; onsubmit: () => void } = $props();

  const limits = settings.calendar;
  const teamOptions = $derived([
    ...(policy.canCreateClubWide() || form.teamId === CLUB_WIDE ? [{ value: CLUB_WIDE, label: 'Ganzer Verein' }] : []),
    ...policy.plannableTeams().map((t) => ({ value: t.id, label: t.name })),
  ]);

  /** Places of the club, plus free text for one-off places (a beach court, the opponent's hall). */
  const OTHER = '';
  let places = $state<Location[]>([]);
  locationsApi.list().then(
    (list) => (places = list),
    () => {},
  );
  const placeOptions = $derived([
    ...places.map((l) => ({ value: l.id, label: l.address ? `${l.name} · ${l.address}` : l.name })),
    { value: OTHER, label: 'Anderer Ort …' },
  ]);
</script>

<EditorForm {action} {submitLabel} {oncancel} {onsubmit} validate={form}>
  <Field label="Titel" error={form.error('title')}>
    <input bind:value={form.title} maxlength={limits.titleMaxLength} required />
  </Field>

  <div class="grid-2">
    <Field label="Art">
      <Select bind:value={form.type} options={appointmentTypes.options(form.type)} />
    </Field>
    <Field label="Für" hint={form.isEdit ? 'Lässt sich nach dem Anlegen nicht mehr ändern.' : undefined}>
      <Select bind:value={form.teamId} options={teamOptions} disabled={form.isEdit} />
    </Field>
    <Field label="Beginn" error={form.error('start')}>
      <DateTimeInput bind:value={() => form.start, (value) => form.setStart(value)} required />
    </Field>
    <Field label="Ende" error={form.error('end')}>
      <DateTimeInput bind:value={form.end} min={form.start} required />
    </Field>
  </div>

  <div class="grid-2">
    <Field label="Ort" hint={places.length ? undefined : 'Orte trägst du unter „Orte“ ein.'}>
      <Select bind:value={form.locationId} options={placeOptions} />
    </Field>
    {#if form.locationId === OTHER}
      <Field label="Anderer Ort" error={form.error('location')}>
        <input bind:value={form.location} maxlength={limits.locationMaxLength} placeholder="z. B. Halle des Gegners" />
      </Field>
    {/if}
  </div>

  {#if form.cabinsShown}
    <div class="grid-2">
      <Field label="Kabine Herren (optional)" error={form.error('cabins')}>
        <input bind:value={form.cabinMen} maxlength={limits.cabinMaxLength} placeholder="z. B. Kabine 2" />
      </Field>
      <Field label="Kabine Damen (optional)">
        <input bind:value={form.cabinWomen} maxlength={limits.cabinMaxLength} placeholder="z. B. Kabine 3" />
      </Field>
    </div>
  {/if}

  <label class="check"><input type="checkbox" bind:checked={() => form.ridesOn, (v) => (form.rides = v)} /> Fahrgemeinschaften anbieten</label>

  <Field label="Beschreibung" error={form.error('description')}>
    <textarea bind:value={form.description} rows="4" maxlength={limits.descriptionMaxLength}></textarea>
  </Field>

  {#if form.original?.seriesId}
    <label class="check">
      <input type="checkbox" bind:checked={form.includeFollowing} />
      Auch alle folgenden Termine der Serie so ändern (Zeiten verschieben sich gleich)
    </label>
  {/if}
  {#if !form.isEdit}
    <label class="check">
      <input type="checkbox" bind:checked={form.repeat} />
      Wöchentlich wiederholen
    </label>
    {#if form.repeat}
      <div class="grid-2">
        <Field label="Alle … Wochen" error={form.error('intervalWeeks')}>
          <input type="number" bind:value={form.intervalWeeks} min="1" max={limits.maxIntervalWeeks} step="1" />
        </Field>
        <Field label="Bis einschließlich" error={form.error('repeatUntil')} hint={form.repeatUntil ? `${form.occurrences()} Termine` : undefined}>
          <DateInput bind:value={form.repeatUntil} min={form.start.slice(0, 10)} />
        </Field>
      </div>
    {/if}
  {/if}
</EditorForm>
