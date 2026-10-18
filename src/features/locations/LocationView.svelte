<script lang="ts">
  import { backStack, bus, pendingDeletes, session } from '../../lib/container';
  import { DetailController, EditSession } from '../../lib/detail/DetailController.svelte';
  import { Resource } from '../../lib/state/Resource.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import Detail from '../../ui/Detail.svelte';
  import LocationMap from '../../ui/LocationMap.svelte';
  import MapButtons from '../../ui/MapButtons.svelte';
  import { tooltip } from '../../ui/tooltip';
  import { calendarApi } from '../calendar/services';
  import { LOCATION_CHANGED } from './events';
  import LocationEditor from './LocationEditor.svelte';
  import { LocationForm } from './LocationForm.svelte';
  import { locationPolicy as policy, locationsApi } from './services';

  /** One place: address, note, map links and the small map, upcoming appointments there. Window and page. */
  let { id, handle, onclosed }: { id: string; handle?: WindowHandle; onclosed?: () => void } = $props();

  // svelte-ignore state_referenced_locally
  const view = new DetailController(bus, handle, onclosed);
  const edit = new EditSession<LocationForm>(bus, backStack);
  // svelte-ignore state_referenced_locally
  const location = new Resource(() => locationsApi.get(id));
  void location.load();
  const upcoming = new Resource(async () => {
    const from = new Date();
    const to = new Date(from.getTime() + 60 * 86_400_000);
    return (await calendarApi.list(from.toISOString(), to.toISOString(), null)).filter((a) => a.locationId === id && !a.cancelled).slice(0, 8);
  });
  void upcoming.load();

  view.title(() => location.value?.name);
  view.watch(LOCATION_CHANGED, (data) => data.locationId === id, {
    deleted: 'Dieser Ort wurde gelöscht.',
    busy: () => edit.save.busy,
    changed: () => !edit.editing && void location.load(),
  });

  async function submit() {
    await edit.submit(async (form) => location.set(await locationsApi.update(id, form.toPatch())), 'Ort gespeichert.');
  }

  function destroy(name: string) {
    // The prop is gone once the view closed, before the undo time ends: keep the id itself.
    const target = id;
    pendingDeletes.schedule({ ids: [target], text: `„${name}“ gelöscht. Termine behalten den Namen.`, commit: () => locationsApi.delete(target) });
    view.leave();
  }
</script>

<AsyncView resource={location}>
  {#snippet children(value)}
    <Detail title={edit.form ? 'Ort bearbeiten' : value.name}>
      {#snippet actions()}
        {#if !edit.form && policy.canManage()}
          <Button icon="edit" onclick={() => edit.edit(LocationForm.edit(value))}>Bearbeiten</Button>
          <Button variant="danger" icon="delete" onclick={() => destroy(value.name)}>Löschen</Button>
        {/if}
      {/snippet}

      {#if edit.form}
        <div class="editing" {@attach edit.track}>
          <LocationEditor form={edit.form} action={edit.save} submitLabel="Speichern" oncancel={() => edit.cancel()} onsubmit={submit} />
        </div>
      {:else}
        <div class="place" class:with-map={value.lat !== null}>
          <div class="info">
            <dl class="props">
              <dt>Adresse</dt>
              <dd>{value.address ?? '–'}</dd>
              <dt>Karte</dt>
              <dd><MapButtons place={value} /></dd>
              {#if value.note}
                <dt>Hinweis</dt>
                <dd class="note">{value.note}</dd>
              {/if}
            </dl>
          </div>
          {#if value.lat !== null && value.lng !== null}<LocationMap lat={value.lat} lng={value.lng} name={value.name} />{/if}
        </div>

        <h2>Nächste Termine hier</h2>
        <AsyncView resource={upcoming}>
          {#snippet children(list)}
            {#if list.length}
              <ul class="uses">
                {#each list as a (a.id)}
                  <li>
                    <button type="button" onclick={() => view.open('appointment', a.id)} {@attach tooltip('Termin öffnen')}>
                      <span class="title">{a.title}</span>
                      <span class="muted">{session.format.dateTime(a.startsAt)}</span>
                    </button>
                  </li>
                {/each}
              </ul>
            {:else}
              <p class="muted none">In den nächsten zwei Monaten ist hier nichts eingetragen.</p>
            {/if}
          {/snippet}
        </AsyncView>
      {/if}
    </Detail>
  {/snippet}
</AsyncView>

<style>
  .editing {
    display: contents;
  }
  .place {
    display: grid;
    gap: var(--space-lg);
  }
  .place.with-map {
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
    align-items: start;
  }
  :global(:root[data-layout='compact']) .place.with-map {
    grid-template-columns: minmax(0, 1fr);
  }
  .note {
    white-space: pre-line;
  }
  .uses li {
    border-bottom: 1px solid var(--color-border);
  }
  .uses button {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-md);
    width: 100%;
    min-height: var(--control-height);
    padding: 2px var(--space-xs);
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    text-align: left;
    cursor: pointer;
  }
  .uses button:hover {
    background: var(--color-hover);
  }
  .title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .none {
    margin: 0;
  }
</style>
