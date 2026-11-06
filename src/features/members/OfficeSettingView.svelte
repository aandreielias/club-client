<script lang="ts">
  import { backStack, bus, session } from '../../lib/container';
  import { DetailController, EditSession } from '../../lib/detail/DetailController.svelte';
  import { StoredRecord } from '../../lib/detail/StoredRecord.svelte';
  import { ADMIN_BOARD } from '../../lib/types';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import Button from '../../ui/Button.svelte';
  import Detail from '../../ui/Detail.svelte';
  import DetailSkeleton from '../../ui/DetailSkeleton.svelte';
  import Tag from '../../ui/Tag.svelte';
  import { Action } from '../../lib/state/Action.svelte';
  import { SEEDED_OFFICES, type OfficeKind } from './MembersApi';
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

  const deleteAction = new Action();

  /** Only a club office nobody ever held and no Sitzungsart or decision names; others are switched off. */
  async function remove(label: string) {
    const request = {
      title: 'Funktion löschen',
      message: `„${label}“ wird gelöscht. Das geht nur, wenn sie nie vergeben war und keine Sitzungsart sie nennt; sonst stelle sie auf „Nicht besetzt“.`,
      confirmLabel: 'Löschen',
      danger: true,
    };
    const ok = await view.confirm(
      request,
      () => view.attempt(deleteAction, () => deleteAction.run(async () => (boardSettings.value = await membersApi.deleteOffice(id)))),
      'Funktion gelöscht.',
    );
    if (ok) view.leave();
  }

  /** The rest of the board settings is sent as the server has it now. */
  async function submit() {
    await edit.submit((form) => stored.saved(() => boardSettings.update((current) => form.toSettings(current))), 'Funktion gespeichert.');
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
        {#if !SEEDED_OFFICES.includes(office.office)}
          <Button variant="danger" icon="delete" busy={deleteAction.busy} onclick={() => remove(office.label)}>Löschen</Button>
        {/if}
      {/if}
    {/snippet}

    {#if edit.form}
      <div class="editing" {@attach edit.track}>
        <OfficeSettingEditor form={edit.form} action={edit.save} oncancel={() => edit.cancel()} onsubmit={submit} />
      </div>
    {:else}
      <dl class="props">
        <dt>In Sitzungen</dt>
        <dd>{office.duty === 'CHAIR' ? 'wie der Vorsitz' : office.duty === 'SECRETARY' ? 'wie die Schriftführung' : '–'}</dd>
        <dt>Vorstand</dt>
        <dd>{office.board ? 'gehört zum Vorstand' : 'außerhalb des Vorstands'}</dd>
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
{:else}
  <DetailSkeleton />
{/if}

<style>
  .editing {
    display: contents;
  }
</style>
