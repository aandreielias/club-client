<script lang="ts">
  import { backStack, bus, commands } from '../../lib/container';
  import { useRecordActions } from '../../lib/actions/useRecordActions.svelte';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import RecordActionButtons from '../../ui/RecordActionButtons.svelte';
  import { CreateController } from '../../lib/detail/CreateController.svelte';
  import { DetailController, EditSession } from '../../lib/detail/DetailController.svelte';
  import { StoredRecord } from '../../lib/detail/StoredRecord.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import Detail from '../../ui/Detail.svelte';
  import DetailSkeleton from '../../ui/DetailSkeleton.svelte';
  import EditorForm from '../../ui/EditorForm.svelte';
  import ChoiceGroup from '../../ui/ChoiceGroup.svelte';
  import ColorSwatches from '../../ui/ColorSwatches.svelte';
  import Field from '../../ui/Field.svelte';
  import Tag from '../../ui/Tag.svelte';
  import { HUES, HUE_LABELS } from '../calendar/model';
  import { statusLabel, TASK_STATUSES, type TaskStageInput } from './model';
  import { taskLabelActions, taskStageActions } from './actions';
  import { taskLabels, taskStages, tasksApi } from './services';

  /** One task status (`stage`: board column in a fixed phase) or label (`id` '-' = new). Admin and board change them. Window only. */
  let { id, handle, stage = false }: { id: string; handle: WindowHandle; stage?: boolean } = $props();

  // svelte-ignore state_referenced_locally
  const isNew = id === '-';
  // svelte-ignore state_referenced_locally
  const kind = stage ? 'task-stage' : 'task-label';
  // svelte-ignore state_referenced_locally
  const noun = stage ? 'Status' : 'Label';
  // svelte-ignore state_referenced_locally
  const store = stage ? taskStages : taskLabels;
  // svelte-ignore state_referenced_locally
  const view = new DetailController(bus, handle);
  const edit = new EditSession<TaskStageInput>(bus, backStack);
  // svelte-ignore state_referenced_locally
  const create = isNew ? new CreateController(bus, handle, `Neuer ${noun}`) : null;
  // svelte-ignore state_referenced_locally
  const stored = new StoredRecord(
    view,
    store,
    () => id,
    `Diesen ${noun} gibt es nicht mehr.`,
    () => edit.save.busy || isNew,
  );
  const entry = $derived(stored.record);
  const phase = $derived(stage && entry ? taskStages.get(entry.key)?.phase : undefined);
  view.title(() => (isNew ? undefined : entry?.label));
  const blank = $state<TaskStageInput>({ label: '', hue: 'blue', phase: 'IN_PROGRESS', sort: 100, archived: false });
  const HUE_OPTIONS = HUES.map((h) => ({ value: h, label: HUE_LABELS[h], hue: h }));
  const form = $derived(isNew ? blank : edit.form);
  let submitted = $state(false);
  const check = {
    get submitted() {
      return submitted;
    },
    set submitted(value: boolean) {
      submitted = value;
    },
    get valid() {
      return !!form?.label.trim();
    },
  };

  /** Labels have no phase; the server's LabelBody ignores it. */
  const write = (key: string | null, f: TaskStageInput) => {
    const label = f.label.trim();
    return stage ? tasksApi.saveStage(key, { ...f, label }) : tasksApi.saveLabel(key, { label, hue: f.hue, sort: f.sort, archived: f.archived });
  };

  async function submit() {
    if (isNew) {
      await create!.submit(
        async () => {
          const saved = await write(null, blank);
          await store.load();
          return saved.key;
        },
        kind,
        `${noun} angelegt.`,
      );
    } else {
      await edit.submit((f) => stored.saved(() => write(id, f)), `${noun} gespeichert.`);
    }
  }

  const act = useRecordActions(
    commands,
    // svelte-ignore state_referenced_locally
    stage ? taskStageActions : taskLabelActions,
    () => (isNew || edit.form ? null : entry),
    () => view.leave(),
  );
  useCommands(commands, {
    'record.edit': {
      run: () => entry && edit.edit({ label: entry.label, hue: entry.hue, phase: phase ?? 'OPEN', sort: entry.sort, archived: entry.archived }),
      when: () => !isNew && !edit.form && !!entry,
    },
  });
</script>

{#snippet editor(f: TaskStageInput)}
  <EditorForm
    action={create?.save ?? edit.save}
    submitLabel={isNew ? 'Anlegen' : 'Speichern'}
    oncancel={() => (isNew ? handle.close() : edit.cancel())}
    onsubmit={submit}
    validate={check}
  >
    <Field label="Bezeichnung" error={submitted && !f.label.trim() ? 'Bezeichnung mit 1 bis 40 Zeichen angeben.' : null}>
      <input bind:value={f.label} maxlength="40" required />
    </Field>
    <ColorSwatches label="Farbe" options={HUE_OPTIONS} bind:value={f.hue} />
    {#if stage}
      <Field
        group
        label="Phase"
        hint={entry?.inUse
          ? 'Bleibt, solange Aufgaben in diesem Status stehen.'
          : 'Erinnerungen, Wiederholung und „erledigt“ richten sich nach der Phase.'}
      >
        <ChoiceGroup name="phase" label="Phase" options={TASK_STATUSES} bind:value={f.phase} disabled={!!entry?.inUse} />
      </Field>
    {/if}
  </EditorForm>
{/snippet}

{#if isNew}
  <Detail title="Neuer {noun}">{@render editor(blank)}</Detail>
{:else if entry}
  <Detail title={edit.form ? `${noun} bearbeiten` : entry.label}>
    {#snippet meta()}
      {#if entry.archived}<Tag tone="gray">Archiviert</Tag>{/if}
    {/snippet}
    {#snippet actions()}
      <RecordActionButtons actions={act} />
    {/snippet}

    {#if form}
      <div class="editing" {@attach edit.track}>{@render editor(form)}</div>
    {:else}
      <dl class="props">
        <dt>Farbe</dt>
        <dd><Tag tone={entry.hue}>{entry.label}</Tag></dd>
        {#if phase}
          <dt>Phase</dt>
          <dd>{statusLabel(phase)}</dd>
        {/if}
        <dt>Verwendet</dt>
        <dd>{entry.inUse ? 'Aufgaben verwenden ihn.' : 'Noch von keiner Aufgabe verwendet.'}</dd>
      </dl>
    {/if}
  </Detail>
{:else}
  <DetailSkeleton />
{/if}

<style>
  .editing {
    display: contents;
  }
</style>
