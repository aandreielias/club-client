<script lang="ts">
  import { settings } from '../../settings';
  import { directory } from '../../lib/container';
  import { Action } from '../../lib/state/Action.svelte';
  import { Resource } from '../../lib/state/Resource.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import Dialog from '../../ui/Dialog.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
  import CheckList from '../../ui/CheckList.svelte';
  import { tooltip } from '../../ui/tooltip';
  import { FolderEditForm } from './FolderEditForm.svelte';
  import { FOLDER_COLORS, FOLDER_SCOPES, scopeLabel, type Folder } from './model';
  import { filePolicy, filesApi, fileTypes } from './services';
  import Thumbnail from './Thumbnail.svelte';

  /** Name, visibility (top-level folders), colour and gallery cover of a folder. */
  let { folder, onsaved, onclose }: { folder: Folder; onsaved: (folder: Folder) => void; onclose: () => void } = $props();

  // svelte-ignore state_referenced_locally
  const form = new FolderEditForm(folder);
  const action = new Action();
  // The folder's own visibility stays selectable even if the member could not create it (e.g. coach editing a club folder name).
  // svelte-ignore state_referenced_locally
  const scopes = FOLDER_SCOPES.filter((s) => filePolicy.rootScopes().includes(s.value) || s.value === folder.scope);
  const teams = filePolicy.rootTeams();
  // Teams already on the folder stay listed even if the member could not choose them (e.g. admin-made shared folders).
  // svelte-ignore state_referenced_locally
  const teamOptions = [...teams.map((t) => ({ value: t.id, label: t.name })), ...folder.teamIds.filter((id) => !teams.some((t) => t.id === id)).map((id) => ({ value: id, label: directory.teamName(id) ?? 'Team' }))];
  // svelte-ignore state_referenced_locally
  const photos = new Resource(async () => (await filesApi.files(folder.id)).filter((f) => fileTypes.isImage(f.contentType)));
  void photos.load();

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    form.submitted = true;
    if (!form.valid) return;
    if (!form.changed) return onclose();
    let saved: Folder | null = null;
    await action.run(async () => (saved = await filesApi.updateFolder(folder.id, form.toPatch())));
    if (saved) onsaved(saved);
  }
</script>

<Dialog open title="Ordner bearbeiten" {onclose}>
  <form class="stack" onsubmit={submit} novalidate>
    <Field label="Name" error={form.error('name')}>
      <!-- svelte-ignore a11y_autofocus -->
      <input bind:value={form.name} maxlength={settings.files.folderNameMaxLength} autofocus required />
    </Field>

    {#if form.canChangeScope}
      <Field label="Sichtbar für" hint="{FOLDER_SCOPES.find((s) => s.value === form.scope)?.hint} Unterordner und Dateien folgen.">
        <Select bind:value={form.scope} options={scopes} />
      </Field>
      {#if form.scope === 'TEAM'}
        <CheckList legend="Teams" bind:value={form.teamIds} options={teamOptions} error={form.error('team')} />
      {/if}
    {:else}
      <p class="muted hint">Sichtbar für: {scopeLabel(folder.scope)}. Unterordner übernehmen die Sichtbarkeit vom obersten Ordner.</p>
    {/if}

    <fieldset class="group">
      <legend>Farbe</legend>
      <div class="swatches">
        <button type="button" class="swatch none" class:chosen={form.color === null} onclick={() => (form.color = null)}
          aria-pressed={form.color === null} {@attach tooltip('Keine Farbe')}><span class="visually-hidden">Keine Farbe</span></button>
        {#each FOLDER_COLORS as color (color.value)}
          <button type="button" class="swatch" class:chosen={form.color === color.value} style:--swatch="var(--color-tag-{color.hue}-text)"
            onclick={() => (form.color = color.value)} aria-pressed={form.color === color.value} {@attach tooltip(color.label)}>
            <span class="visually-hidden">{color.label}</span>
          </button>
        {/each}
      </div>
    </fieldset>

    <fieldset class="group">
      <legend>Titelbild in der Galerie</legend>
      <AsyncView resource={photos}>
        {#snippet children(list)}
          {#if list.length}
            <div class="covers">
              <button type="button" class="cover none" class:chosen={form.coverFileId === null} onclick={() => (form.coverFileId = null)}
                aria-pressed={form.coverFileId === null} {@attach tooltip('Kein Titelbild')}>Keins</button>
              {#each list as photo (photo.id)}
                <button type="button" class="cover" class:chosen={form.coverFileId === photo.id} onclick={() => (form.coverFileId = photo.id)}
                  aria-pressed={form.coverFileId === photo.id} {@attach tooltip(photo.name)}>
                  <Thumbnail file={photo} />
                </button>
              {/each}
            </div>
          {:else}
            <p class="muted hint">Lade Fotos in diesen Ordner hoch, um eins als Titelbild zu wählen.</p>
          {/if}
        {/snippet}
      </AsyncView>
    </fieldset>

    <ErrorNote error={action.error} />
    <div class="row end">
      <Button variant="ghost" onclick={onclose}>Abbrechen</Button>
      <Button type="submit" variant="primary" busy={action.busy}>Speichern</Button>
    </div>
  </form>
</Dialog>

<style>
  .hint {
    margin: 0;
    font-size: var(--font-size-small);
  }
  .group {
    display: grid;
    gap: var(--space-xs);
    margin: 0;
    padding: 0;
    border: 0;
  }
  legend {
    margin-bottom: var(--space-xs);
    color: var(--color-text-muted);
    font-size: var(--font-size-small);
    font-weight: var(--font-weight-medium);
  }
  .swatches {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm);
  }
  .swatch {
    width: 24px;
    height: 24px;
    padding: 0;
    border: 2px solid var(--color-elevated);
    border-radius: 50%;
    background: var(--swatch);
    box-shadow: 0 0 0 1px var(--color-border);
    cursor: pointer;
    transition:
      transform var(--motion-fast) var(--motion-easing),
      box-shadow var(--motion-fast);
  }
  .swatch:hover {
    transform: scale(1.1);
  }
  .swatch.none {
    background: linear-gradient(135deg, transparent 45%, var(--color-text-faint) 45% 55%, transparent 55%), var(--color-field);
  }
  .swatch.chosen {
    box-shadow: 0 0 0 2px var(--color-accent);
  }
  .covers {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(4.5rem, 1fr));
    gap: var(--space-sm);
    max-height: 13rem;
    overflow-y: auto;
  }
  .cover {
    aspect-ratio: 1;
    padding: 0;
    overflow: hidden;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-text-muted);
    font-size: var(--font-size-small);
    cursor: pointer;
    transition: box-shadow var(--motion-fast);
  }
  .cover.chosen {
    border-color: transparent;
    box-shadow: 0 0 0 2px var(--color-accent);
  }
  .end {
    justify-content: flex-end;
  }
</style>
