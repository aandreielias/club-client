<script lang="ts">
  import { backStack, bus, commands, session } from '../../lib/container';
  import { useRecordActions } from '../../lib/actions/useRecordActions.svelte';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import RecordActionButtons from '../../ui/RecordActionButtons.svelte';
  import { holidayActions } from './actions';
  import { DetailController, EditSession } from '../../lib/detail/DetailController.svelte';
  import { StoredRecord } from '../../lib/detail/StoredRecord.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import Detail from '../../ui/Detail.svelte';
  import DetailSkeleton from '../../ui/DetailSkeleton.svelte';
  import HolidayEditor from './HolidayEditor.svelte';
  import type { Holiday } from './model';
  import { calendarApi, holidays } from './services';

  /** One holiday; admin and board edit it. Window and page. */
  let { id, handle, onclosed }: { id: string; handle?: WindowHandle; onclosed?: () => void } = $props();

  // svelte-ignore state_referenced_locally
  const view = new DetailController(bus, handle, onclosed);
  const edit = new EditSession<Omit<Holiday, 'id'>>(bus, backStack);
  // svelte-ignore state_referenced_locally
  const stored = new StoredRecord(
    view,
    holidays,
    () => id,
    'Diese Ferien gibt es nicht mehr.',
    () => edit.save.busy,
  );
  const holiday = $derived(stored.record);
  view.title(() => holiday?.name);

  async function submit() {
    await edit.submit((form) => stored.saved(() => calendarApi.saveHoliday(id, { ...form, name: form.name.trim() })), 'Ferien gespeichert.');
  }

  const act = useRecordActions(
    commands,
    holidayActions,
    () => (edit.form ? null : holiday),
    () => view.leave(),
  );
  useCommands(commands, {
    'record.edit': {
      run: () => holiday && edit.edit({ name: holiday.name, from: holiday.from, to: holiday.to }),
      when: () => !edit.form && !!holiday,
    },
  });
</script>

{#if holiday}
  <Detail
    title={edit.form ? 'Ferien bearbeiten' : holiday.name}
    hint="Neue wöchentliche Serien lassen diese Tage aus. Bestehende Termine sagst du im Kalender mit „Zeitraum absagen“ ab."
  >
    {#snippet actions()}
      <RecordActionButtons actions={act} />
    {/snippet}

    {#if edit.form}
      <div class="editing" {@attach edit.track}>
        <HolidayEditor form={edit.form} action={edit.save} submitLabel="Speichern" oncancel={() => edit.cancel()} onsubmit={submit} />
      </div>
    {:else}
      <dl class="props">
        <dt>Von</dt>
        <dd>{session.format.date(holiday.from)}</dd>
        <dt>Bis</dt>
        <dd>{session.format.date(holiday.to)}</dd>
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
