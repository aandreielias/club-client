<script lang="ts">
  import { backStack, bus, session } from '../../lib/container';
  import { DetailController, EditSession } from '../../lib/detail/DetailController.svelte';
  import { StoredRecord } from '../../lib/detail/StoredRecord.svelte';
  import { ADMIN_BOARD } from '../../lib/types';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import Button from '../../ui/Button.svelte';
  import Detail from '../../ui/Detail.svelte';
  import Tag from '../../ui/Tag.svelte';
  import type { OfficeKind } from './MembersApi';
  import OfficeSettingEditor from './OfficeSettingEditor.svelte';
  import { OfficeSettingForm, partnersOf } from './OfficeSettingForm.svelte';
  import { boardSettings, membersApi } from './services';

  /** One office of the board settings; admin and board edit it. Window. */
  let { id, handle, onclosed }: { id: string; handle?: WindowHandle; onclosed?: () => void } = $props();

  // svelte-ignore state_referenced_locally
  const view = new DetailController(bus, handle, onclosed);
  const edit = new EditSession<OfficeSettingForm>(bus, backStack);
  // svelte-ignore state_referenced_locally
  const stored = new StoredRecord(
    view,
    boardSettings,
    () => id,
    'Diese Funktion gibt es nicht.',
    () => edit.save.busy,
  );
  const office = $derived(stored.record);
  view.title(() => office?.label);
  const partners = $derived(boardSettings.value ? partnersOf(boardSettings.value, id as OfficeKind).map((o) => boardSettings.label(o)) : []);

  /** The rest of the board settings is sent as the server has it now. */
  async function submit() {
    await edit.submit(
      (form) =>
        stored.saved(async () => (boardSettings.value = await membersApi.saveBoardSettings(form.toSettings(await membersApi.boardSettings())))),
      'Funktion gespeichert.',
    );
  }
</script>

{#if office}
  <Detail title={edit.form ? 'Funktion bearbeiten' : office.label}>
    {#snippet meta()}
      {#if !office.enabled}<Tag tone="gray">Nicht besetzt</Tag>{/if}
    {/snippet}
    {#snippet actions()}
      {#if !edit.form && session.hasRole(...ADMIN_BOARD) && boardSettings.value}
        <Button icon="edit" onclick={() => edit.edit(new OfficeSettingForm(boardSettings.value!, office.office))}>Bearbeiten</Button>
      {/if}
    {/snippet}

    {#if edit.form}
      <div class="editing" {@attach edit.track}>
        <OfficeSettingEditor form={edit.form} action={edit.save} oncancel={() => edit.cancel()} onsubmit={submit} />
      </div>
    {:else}
      <dl class="props">
        <dt>In Verwendung</dt>
        <dd>{office.enabled ? 'wird besetzt' : 'wird nicht mehr vergeben'}</dd>
        {#if office.enabled}
          <dt>Personen</dt>
          <dd>{office.maxHolders == null ? `mindestens ${office.minHolders}` : `${office.minHolders} bis ${office.maxHolders}`}</dd>
          <dt>Funktionsperiode</dt>
          <dd>{office.termYears} {office.termYears === 1 ? 'Jahr' : 'Jahre'}</dd>
          <dt>Zugleich mit</dt>
          <dd>{partners.length ? partners.join(', ') : 'keiner anderen Funktion'}</dd>
        {/if}
      </dl>
    {/if}
  </Detail>
{/if}

<style>
  .editing {
    display: contents;
  }
</style>
