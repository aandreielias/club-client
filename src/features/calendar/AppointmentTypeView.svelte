<script lang="ts">
  import { backStack, bus, session } from '../../lib/container';
  import { DetailController, EditSession } from '../../lib/detail/DetailController.svelte';
  import { ADMIN_BOARD } from '../../lib/types';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import Button from '../../ui/Button.svelte';
  import Detail from '../../ui/Detail.svelte';
  import Tag from '../../ui/Tag.svelte';
  import AppointmentTypeEditor from './AppointmentTypeEditor.svelte';
  import type { AppointmentTypeInput } from './model';
  import { appointmentTypes, calendarApi } from './services';

  /** One appointment type; admin and board edit it. Window and page. */
  let { id, handle, onclosed }: { id: string; handle?: WindowHandle; onclosed?: () => void } = $props();

  // svelte-ignore state_referenced_locally
  const view = new DetailController(bus, handle, onclosed);
  const edit = new EditSession<AppointmentTypeInput>(bus, backStack);
  let loaded = $state(false);
  let removed = false;
  void appointmentTypes.load().then(() => (loaded = true), () => (loaded = true));

  const type = $derived(appointmentTypes.get(id));
  view.title(() => type?.label);
  $effect(() => {
    if (loaded && !type && !edit.save.busy) {
      if (!removed) view.notify('Diese Terminart gibt es nicht mehr.');
      view.leave();
    }
  });

  async function submit() {
    await edit.submit(async (form) => {
      await calendarApi.saveType(id, { ...form, label: form.label.trim() });
      await appointmentTypes.load();
    }, 'Terminart gespeichert.');
  }

  async function remove(label: string) {
    await view.confirm({ title: 'Terminart löschen', message: label, confirmLabel: 'Löschen', danger: true },
      () => view.attempt(edit.save, () => edit.save.run(async () => {
        removed = true;
        await calendarApi.deleteType(id);
        await appointmentTypes.load();
      })), 'Terminart gelöscht.');
  }
</script>

{#if type}
  <Detail title={edit.form ? 'Terminart bearbeiten' : type.label}>
    {#snippet actions()}
      {#if !edit.form && session.hasRole(...ADMIN_BOARD)}
        <Button icon="edit" onclick={() => edit.edit({ label: type.label, hue: type.hue, rides: type.rides, cabins: type.cabins, sort: type.sort, archived: type.archived })}>Bearbeiten</Button>
        {#if !type.inUse}<Button variant="danger" icon="delete" onclick={() => remove(type.label)}>Löschen</Button>{/if}
      {/if}
    {/snippet}

    {#if edit.form}
      <div class="editing" {@attach edit.track}>
        <AppointmentTypeEditor form={edit.form} action={edit.save} submitLabel="Speichern" canArchive oncancel={() => edit.cancel()} onsubmit={submit} />
      </div>
    {:else}
      <dl class="props">
        <dt>Im Kalender</dt><dd><Tag tone={type.hue}>{type.label}</Tag>{#if type.archived} <Tag tone="gray">Archiviert</Tag>{/if}</dd>
        <dt>Fahrgemeinschaften</dt><dd>{type.rides ? 'werden angeboten' : 'keine'}</dd>
        <dt>Kabinen</dt><dd>{type.cabins ? 'werden angegeben' : 'keine'}</dd>
        <dt>Verwendet</dt><dd>{type.inUse ? 'Es gibt Termine dieser Art.' : 'Noch keine Termine.'}</dd>
      </dl>
    {/if}
  </Detail>
{/if}

<style>
  .editing {
    display: contents;
  }
</style>
