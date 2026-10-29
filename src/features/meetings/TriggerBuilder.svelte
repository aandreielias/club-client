<script lang="ts">
  import { directory } from '../../lib/container';
  import { Resource } from '../../lib/state/Resource.svelte';
  import ChoiceGroup from '../../ui/ChoiceGroup.svelte';
  import DateInput from '../../ui/DateInput.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
  import { appointmentTypes } from '../calendar/services';
  import { filesApi } from '../files/services';
  import { boardSettings, membershipKinds } from '../members/services';
  import { meetingTypes, resolutionRules } from './services';
  import {
    describeTrigger,
    emptyWindow,
    FIELD_LABELS,
    newTrigger,
    TRIGGER_CATALOG,
    TRIGGER_PRESETS,
    type Trigger,
    type TriggerField,
    type TriggerRecord,
  } from './triggers';

  /**
   * "Von selbst, wenn …": which record, what happens to it, and the conditions on its attributes; appointments also a date window
   * (days after the task starts, and in motions fixed dates).
   */
  let { trigger = $bindable(), allowDates = false }: { trigger: Trigger | null; allowDates?: boolean } = $props();

  const ANY = '';
  const RECORDS = (Object.keys(TRIGGER_CATALOG) as TriggerRecord[]).map((r) => ({ value: r, label: TRIGGER_CATALOG[r].label }));
  const PRESETS = TRIGGER_PRESETS.map((p) => ({ value: p.key, label: p.label }));
  const entry = $derived(trigger ? TRIGGER_CATALOG[trigger.record] : null);
  const events = $derived(entry ? Object.entries(entry.events).map(([value, label]) => ({ value, label })) : []);

  const folders = new Resource(() => filesApi.folders());
  const folderId = $derived(trigger?.conditions.find((c) => c.field === 'folder')?.value ?? null);
  const files = new Resource(() => (folderId ? filesApi.files(folderId) : Promise.resolve([])));
  $effect(() => {
    if (entry?.fields.includes('folder') && !folders.value && !folders.loading) void folders.load();
  });
  $effect(() => {
    void folderId;
    if (entry?.fields.includes('file')) void files.load();
  });
  $effect(() => {
    if (entry?.fields.includes('team')) void directory.loadTeams().catch(() => {});
  });

  function options(field: TriggerField): { value: string; label: string }[] {
    switch (field) {
      case 'folder':
        return (folders.value ?? []).map((f) => ({ value: f.id, label: f.name }));
      case 'file':
        return (files.value ?? []).filter((f) => !f.contentType.startsWith('image/')).map((f) => ({ value: f.id, label: f.name }));
      case 'type':
        return trigger?.record === 'MEETING'
          ? meetingTypes.items.filter((t) => !t.archived).map((t) => ({ value: t.key, label: t.label }))
          : appointmentTypes.items.filter((t) => !t.archived).map((t) => ({ value: t.key, label: t.label }));
      case 'team':
        return directory.teams.map((t) => ({ value: t.id, label: t.name }));
      case 'decision':
        return resolutionRules.all().map((a) => ({ value: a, label: resolutionRules.label(a) }));
      case 'office':
        return boardSettings.enabled.map((o) => ({ value: o, label: boardSettings.label(o) }));
      case 'kind':
        return membershipKinds.items.filter((k) => !k.archived).map((k) => ({ value: k.key, label: k.label }));
    }
  }

  function preset(key: string) {
    const p = TRIGGER_PRESETS.find((x) => x.key === key);
    if (p) trigger = newTrigger(p.trigger.record, p.trigger.event, !!p.window);
  }

  function setRecord(record: string) {
    const r = record as TriggerRecord;
    if (r && r !== trigger?.record) trigger = newTrigger(r, Object.keys(TRIGGER_CATALOG[r].events)[0]);
  }

  function setValue(field: TriggerField, value: string) {
    if (!trigger) return;
    const rest = trigger.conditions.filter((c) => c.field !== field && !(field === 'folder' && c.field === 'file'));
    const label = options(field).find((o) => o.value === value)?.label ?? null;
    trigger = { ...trigger, conditions: value ? [...rest, { field, value, label }] : rest };
  }

  const value = (field: TriggerField) => trigger?.conditions.find((c) => c.field === field)?.value ?? ANY;

  type WindowMode = 'none' | 'days' | 'dates';
  const MODES = $derived([
    { value: 'none' as const, label: 'Jederzeit' },
    { value: 'days' as const, label: 'Tage nach Start' },
    ...(allowDates ? [{ value: 'dates' as const, label: 'Datum' }] : []),
  ]);
  const mode = $derived<WindowMode>(!trigger?.window ? 'none' : trigger.window.fromDate || trigger.window.toDate ? 'dates' : 'days');

  function setMode(next: WindowMode) {
    if (!trigger || next === mode) return;
    trigger = {
      ...trigger,
      window: next === 'none' ? null : next === 'days' ? { ...emptyWindow(), fromDays: 0, toDays: 30 } : emptyWindow(),
    };
  }

  const num = (v: unknown) => (v === '' || v == null ? null : Math.round(Number(v)));
</script>

<div class="stack builder">
  <Field label="Vorlage" hint="Ein häufiger Fall; danach anpassbar.">
    <Select options={PRESETS} placeholder="Vorlage wählen" bind:value={() => '', preset} aria-label="Vorlage" />
  </Field>
  <div class="grid-2">
    <Field label="Datensatz">
      <Select options={RECORDS} placeholder="Bitte wählen" bind:value={() => trigger?.record ?? '', setRecord} aria-label="Datensatz" />
    </Field>
    {#if trigger}
      <Field label="Ereignis">
        <Select options={events} bind:value={() => trigger!.event, (v) => v && (trigger = { ...trigger!, event: v })} aria-label="Ereignis" />
      </Field>
    {/if}
  </div>

  {#if trigger && entry}
    {#if entry.fields.length}
      <div class="grid-2">
        {#each entry.fields as field (field)}
          <Field label="{FIELD_LABELS[field]} (optional)">
            {#if field === 'folder' && folders.error}
              <ErrorNote error={folders.error} />
            {:else if field === 'file' && !folderId}
              <p class="muted small">Erst einen Ordner wählen.</p>
            {:else}
              <Select
                options={[{ value: ANY, label: 'Beliebig' }, ...options(field)]}
                bind:value={() => value(field), (v) => setValue(field, v ?? '')}
                aria-label={FIELD_LABELS[field]}
              />
            {/if}
          </Field>
        {/each}
      </div>
    {/if}

    {#if entry.window}
      <Field label="Termin am">
        <ChoiceGroup name="trigger-window" label="Termin am" options={MODES} bind:value={() => mode, (v) => v && setMode(v)} />
      </Field>
      {#if trigger.window && mode === 'days'}
        <div class="row">
          <input
            type="number"
            min="0"
            max="365"
            class="short"
            aria-label="Ab Tag"
            bind:value={() => trigger!.window!.fromDays ?? '', (v) => (trigger = { ...trigger!, window: { ...trigger!.window!, fromDays: num(v) } })}
          />
          <span class="muted small">bis</span>
          <input
            type="number"
            min="0"
            max="365"
            class="short"
            aria-label="Bis Tag"
            bind:value={() => trigger!.window!.toDays ?? '', (v) => (trigger = { ...trigger!, window: { ...trigger!.window!, toDays: num(v) } })}
          />
          <span class="muted small">Tage nach dem Start der Aufgabe</span>
        </div>
      {:else if trigger.window && mode === 'dates'}
        <div class="grid-2">
          <Field label="Von">
            <DateInput
              bind:value={
                () => trigger!.window!.fromDate ?? '', (v) => (trigger = { ...trigger!, window: { ...trigger!.window!, fromDate: v || null } })
              }
            />
          </Field>
          <Field label="Bis">
            <DateInput
              bind:value={() => trigger!.window!.toDate ?? '', (v) => (trigger = { ...trigger!, window: { ...trigger!.window!, toDate: v || null } })}
            />
          </Field>
        </div>
      {/if}
    {/if}
    <p class="muted small">Erledigt sich, sobald {describeTrigger(trigger)}.</p>
  {/if}
</div>

<style>
  p {
    margin: 0;
  }
  .short {
    width: 5rem;
  }
</style>
