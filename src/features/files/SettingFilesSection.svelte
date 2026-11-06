<script lang="ts">
  import { TOAST } from '../../channels';
  import { bus } from '../../lib/container';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import { Action } from '../../lib/state/Action.svelte';
  import { Resource } from '../../lib/state/Resource.svelte';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import RecordLink from '../../ui/RecordLink.svelte';
  import SearchSelect from '../../ui/SearchSelect.svelte';
  import { FILES_CHANGED } from './events';
  import type { SettingSlot } from './model';
  import { filesApi } from './services';
  import Thumbnail from './Thumbnail.svelte';

  /**
   * Files the settings use (admin/board). Each slot holds a copy in the read-only folder "Einstellungen": picked from Dateien
   * it follows new versions of its original; an own upload here unlinks it and leaves the original as it is.
   */
  let { slots }: { slots: readonly { slot: SettingSlot; label: string; hint: string }[] } = $props();

  const LOGO = ['image/png', 'image/jpeg', 'image/svg+xml'];
  const TEMPLATE = ['application/vnd.openxmlformats-officedocument.wordprocessingml.template'];
  // Mail programs don't show SVG: the e-mail logo takes PNG and JPEG only (server: SettingFileHandlers).
  const MAIL_LOGO = ['image/png', 'image/jpeg'];
  const typesOf = (slot: SettingSlot) => (slot.endsWith('_TEMPLATE') ? TEMPLATE : slot === 'MAIL_LOGO' ? MAIL_LOGO : LOGO);
  const accept = (slot: SettingSlot) =>
    slot.endsWith('_TEMPLATE') ? '.dotx' : slot === 'MAIL_LOGO' ? 'image/png,image/jpeg' : 'image/png,image/jpeg,image/svg+xml,.svg';

  const files = new Resource(() => filesApi.settingFiles());
  void files.load();
  // A new version of an original reaches its copy; the list shows the new state.
  useBus(bus, FILES_CHANGED, () => void files.load());

  const action = new Action();
  let input = $state<HTMLInputElement>();
  let uploading = $state<SettingSlot | null>(null);

  async function search(slot: SettingSlot, query: string) {
    const hits = await filesApi.search(query, 20);
    return hits.filter((f) => typesOf(slot).includes(f.contentType)).map((f) => ({ value: f.id, label: `${f.name} · ${f.folderName}` }));
  }

  async function change(text: string, run: () => Promise<unknown>) {
    if (await action.run(run)) {
      bus.publish(TOAST, { text });
      await files.load();
    }
  }

  function upload(slot: SettingSlot) {
    uploading = slot;
    if (!input) return;
    input.accept = accept(slot); // set before the click, the attribute would update only after it
    input.click();
  }

  function picked(event: Event & { currentTarget: HTMLInputElement }) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    const slot = uploading;
    if (file && slot) void change('Datei gespeichert.', () => filesApi.uploadSettingFile(slot, file));
  }
</script>

<input bind:this={input} type="file" onchange={picked} hidden />
{#each slots as { slot, label, hint } (slot)}
  {@const current = files.value?.find((f) => f.slot === slot)}
  <div class="slot">
    <span class="thumb"
      >{#if current && !slot.endsWith('_TEMPLATE')}<Thumbnail file={current.file} />{/if}</span
    >
    <span class="stack-tight">
      <strong>{label}</strong>
      <span class="muted small">{hint}</span>
      {#if current}
        <span class="small">
          {#if slot.endsWith('_TEMPLATE')}<RecordLink kind="file" id={current.file.id}>{current.file.name}</RecordLink> ·
          {/if}
          {#if current.sourceId}
            Verknüpft mit <RecordLink kind="file" id={current.sourceId}>{current.sourceName ?? 'Datei'}</RecordLink>
          {:else}
            Eigene Datei
          {/if}
        </span>
      {:else}
        <span class="muted small">Nicht gesetzt</span>
      {/if}
    </span>
    <span class="row">
      <SearchSelect
        search={(q) => search(slot, q)}
        onpick={(id) => change(`${label} verknüpft.`, () => filesApi.pickSettingFile(slot, id))}
        placeholder="Aus Dateien wählen"
        debounceMs={200}
        aria-label="{label} aus Dateien wählen"
      />
      <Button icon="upload" busy={action.busy} tooltip="Eigene Datei hochladen (löst die Verknüpfung)" onclick={() => upload(slot)} />
      {#if current}
        <Button
          variant="danger"
          icon="delete"
          tooltip="{label} entfernen"
          onclick={() => change(`${label} entfernt.`, () => filesApi.clearSettingFile(slot))}
        />
      {/if}
    </span>
  </div>
{/each}
<ErrorNote error={action.error ?? files.error} />

<style>
  .slot {
    display: grid;
    grid-template-columns: 48px minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-md);
  }
  .thumb {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    overflow: hidden;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
  }
  .thumb :global(img) {
    max-width: 40px;
    max-height: 40px;
  }
  .stack-tight {
    display: grid;
  }
  :global(:root[data-layout='compact']) .slot {
    grid-template-columns: 48px minmax(0, 1fr);
  }
  :global(:root[data-layout='compact']) .slot .row {
    grid-column: 1 / -1;
  }
</style>
