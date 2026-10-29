<script lang="ts">
  import { Resource } from '../../lib/state/Resource.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
  import { appointmentTypes } from '../calendar/services';
  import { filesApi } from '../files/services';
  import type { FollowUpKind } from './model';
  import { meetingTypes } from './services';

  /** What a follow-up that finishes itself waits for: a folder in Dateien, a kind of meeting or a kind of appointment. */
  let { kind, target = $bindable(), targetName = $bindable() }: { kind: FollowUpKind; target: string | null; targetName: string | null } = $props();

  const folders = new Resource(() => filesApi.folders());
  $effect(() => {
    if (kind === 'UPLOAD_FILE' && !folders.value && !folders.loading) void folders.load();
  });

  const options = $derived(
    kind === 'UPLOAD_FILE'
      ? (folders.value ?? []).map((f) => ({ value: f.id, label: f.name }))
      : kind === 'INVITE_MEETING'
        ? meetingTypes.items.filter((t) => !t.archived).map((t) => ({ value: t.key, label: t.label }))
        : appointmentTypes.items.filter((t) => !t.archived).map((t) => ({ value: t.key, label: t.label })),
  );
  const LABELS: Partial<Record<FollowUpKind, { label: string; hint: string }>> = {
    UPLOAD_FILE: { label: 'Ordner', hint: 'Eine neue Datei oder Version in diesem Ordner erledigt die Aufgabe.' },
    INVITE_MEETING: { label: 'Art der Sitzung', hint: 'Die Einladung zu einer Sitzung dieser Art erledigt die Aufgabe.' },
    CREATE_APPOINTMENT: { label: 'Art des Termins', hint: 'Ein neuer Termin dieser Art erledigt die Aufgabe.' },
  };

  function pick(value: string) {
    target = value || null;
    targetName = options.find((o) => o.value === value)?.label ?? null;
  }
</script>

{#if LABELS[kind]}
  <Field label={LABELS[kind]!.label} hint={LABELS[kind]!.hint}>
    {#if kind === 'UPLOAD_FILE' && folders.error}
      <ErrorNote error={folders.error} />
    {:else}
      <Select
        {options}
        placeholder={kind === 'UPLOAD_FILE' && !folders.value ? 'Ordner werden geladen …' : (targetName ?? 'Bitte wählen')}
        bind:value={() => target ?? '', pick}
        aria-label={LABELS[kind]!.label}
      />
    {/if}
  </Field>
{/if}
