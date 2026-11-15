<script lang="ts">
  import { backStack, bus, commands } from '../../lib/container';
  import { useRecordActions } from '../../lib/actions/useRecordActions.svelte';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import RecordActionButtons from '../../ui/RecordActionButtons.svelte';
  import { categoryActions } from './actions';
  import { CreateController } from '../../lib/detail/CreateController.svelte';
  import { DetailController, EditSession } from '../../lib/detail/DetailController.svelte';
  import { StoredRecord } from '../../lib/detail/StoredRecord.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import Detail from '../../ui/Detail.svelte';
  import DetailSkeleton from '../../ui/DetailSkeleton.svelte';
  import EditorForm from '../../ui/EditorForm.svelte';
  import ChoiceGroup from '../../ui/ChoiceGroup.svelte';
  import Field from '../../ui/Field.svelte';
  import Tag from '../../ui/Tag.svelte';
  import { settings } from '../../settings';
  import type { CategoryInput } from './model';
  import { categories, financeApi, financeMay } from './services';

  /** One category of bookings (`id` '-' = new): name and money in or out (fixed once used); WRITE holders change it. Window only. */
  let { id, handle }: { id: string; handle: WindowHandle } = $props();

  // svelte-ignore state_referenced_locally
  const isNew = id === '-';
  // svelte-ignore state_referenced_locally
  const view = new DetailController(bus, handle);
  const edit = new EditSession<CategoryInput>(bus, backStack);
  // svelte-ignore state_referenced_locally
  const create = isNew ? new CreateController(bus, handle, 'Neue Kategorie') : null;
  // svelte-ignore state_referenced_locally
  const stored = new StoredRecord(
    view,
    categories,
    () => id,
    'Diese Kategorie gibt es nicht mehr.',
    () => edit.save.busy || isNew,
  );
  const category = $derived(stored.record);
  view.title(() => (isNew ? undefined : category?.label));
  const blank = $state<CategoryInput>({ label: '', direction: 'OUT', sort: 10, archived: false });
  const DIRECTIONS = [
    { value: 'IN', label: 'Einnahme' },
    { value: 'OUT', label: 'Ausgabe' },
  ] as const;
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

  async function submit() {
    if (isNew) {
      await create!.submit(
        async () => {
          const saved = await financeApi.saveCategory(null, { ...blank, label: blank.label.trim() });
          await categories.load();
          return saved.key;
        },
        'finance-category',
        'Kategorie angelegt.',
      );
    } else {
      await edit.submit((f) => stored.saved(() => financeApi.saveCategory(id, { ...f, label: f.label.trim() })), 'Kategorie gespeichert.');
    }
  }

  const act = useRecordActions(
    commands,
    categoryActions,
    () => (isNew || edit.form ? null : category),
    () => view.leave(),
  );
  useCommands(commands, {
    'record.edit': {
      run: () => category && edit.edit({ label: category.label, direction: category.direction, sort: category.sort, archived: category.archived }),
      when: () => !isNew && !edit.form && !!category && financeMay('WRITE'),
    },
  });
</script>

{#snippet editor(f: CategoryInput)}
  <EditorForm
    action={create?.save ?? edit.save}
    submitLabel={isNew ? 'Anlegen' : 'Speichern'}
    oncancel={() => (isNew ? handle.close() : edit.cancel())}
    onsubmit={submit}
    validate={check}
  >
    <Field
      label="Bezeichnung"
      error={submitted && !f.label.trim() ? `Bezeichnung mit 1 bis ${settings.finance.labelMaxLength} Zeichen angeben.` : null}
    >
      <input bind:value={f.label} maxlength={settings.finance.labelMaxLength} required />
    </Field>
    <Field group label="Art" hint={category?.inUse ? 'Bleibt, solange es Buchungen dieser Kategorie gibt.' : undefined}>
      <ChoiceGroup name="direction" label="Art" options={DIRECTIONS} bind:value={f.direction} disabled={!!category?.inUse} />
    </Field>
  </EditorForm>
{/snippet}

{#if isNew}
  <Detail title="Neue Kategorie">{@render editor(blank)}</Detail>
{:else if category}
  <Detail title={edit.form ? 'Kategorie bearbeiten' : category.label}>
    {#snippet meta()}
      {#if category.archived}<Tag tone="gray">Archiviert</Tag>{/if}
    {/snippet}
    {#snippet actions()}
      <RecordActionButtons actions={act} />
    {/snippet}

    {#if form}
      <div class="editing" {@attach edit.track}>{@render editor(form)}</div>
    {:else}
      <dl class="props">
        <dt>Art</dt>
        <dd>{category.direction === 'IN' ? 'Einnahme' : 'Ausgabe'}</dd>
        <dt>Verwendet</dt>
        <dd>{category.inUse ? 'Es gibt Buchungen dieser Kategorie.' : 'Noch keine Buchungen.'}</dd>
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
