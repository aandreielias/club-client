<script lang="ts">
  import { Resource } from '../../lib/state/Resource.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
  import { filesApi } from '../files/services';
  import type { StatutesPlace } from './model';

  /**
   * Where the club keeps its statutes (Dateien): a folder, and in it the statutes file. A new version of that file finishes "Neue Statuten
   * hochladen"; with "Jede neue Datei" any upload into the folder does.
   */
  let { value = $bindable() }: { value: StatutesPlace } = $props();

  const ANY = '';
  const folders = new Resource(() => filesApi.folders());
  void folders.load();
  const files = new Resource(() => (value.folderId ? filesApi.files(value.folderId) : Promise.resolve([])));
  $effect(() => {
    void value.folderId;
    void files.load();
  });

  const folderOptions = $derived([
    { value: ANY, label: 'Nicht festgelegt (von Hand erledigen)' },
    ...(folders.value ?? []).filter((f) => f.kind === 'DOCUMENTS').map((f) => ({ value: f.id, label: f.name })),
  ]);
  const fileOptions = $derived([
    { value: ANY, label: 'Jede neue Datei in diesem Ordner' },
    ...(files.value ?? []).filter((f) => !f.contentType.startsWith('image/')).map((f) => ({ value: f.id, label: f.name })),
  ]);

  function pickFolder(id: string | null) {
    const folder = folders.value?.find((f) => f.id === id);
    value = { folderId: folder?.id ?? null, folderName: folder?.name ?? null, fileId: null, fileName: null };
  }

  function pickFile(id: string | null) {
    const file = files.value?.find((f) => f.id === id);
    value = { ...value, fileId: file?.id ?? null, fileName: file?.name ?? null };
  }
</script>

<div class="grid-2">
  <Field label="Statuten liegen im Ordner" hint="In Dateien; nur Dokument-Ordner.">
    {#if folders.error}
      <ErrorNote error={folders.error} />
    {:else}
      <Select
        options={folderOptions}
        placeholder={folders.value ? undefined : 'Ordner werden geladen …'}
        disabled={!folders.value}
        bind:value={() => value.folderId ?? ANY, pickFolder}
        aria-label="Ordner der Statuten"
      />
    {/if}
  </Field>
  {#if value.folderId}
    <Field label="Statuten-Datei" hint="Eine neue Version dieser Datei erledigt die Aufgabe.">
      <Select options={fileOptions} disabled={!files.value} bind:value={() => value.fileId ?? ANY, pickFile} aria-label="Statuten-Datei" />
    </Field>
  {/if}
</div>
