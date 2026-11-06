<script lang="ts">
  import { settings } from '../../settings';
  import { directory } from '../../lib/container';
  import { Action } from '../../lib/state/Action.svelte';
  import { Resource } from '../../lib/state/Resource.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import Dialog from '../../ui/Dialog.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import ColorSwatches from '../../ui/ColorSwatches.svelte';
  import Field from '../../ui/Field.svelte';
  import { TeamListModel } from '../../lib/directory/TeamListModel.svelte';
  import { session } from '../../lib/container';
  import { tooltip } from '../../ui/tooltip';
  import { FolderEditForm } from './FolderEditForm.svelte';
  import { FOLDER_COLORS, FOLDER_SCOPES, scopeLabel, type Folder } from './model';
  import { filePolicy, filesApi, fileTypes } from './services';
  import FolderVisibility from './FolderVisibility.svelte';
  import Thumbnail from './Thumbnail.svelte';

  /** Name, visibility (top-level folders), colour and gallery cover of a folder. */
  let { folder, onsaved, onclose }: { folder: Folder; onsaved: (folder: Folder) => void; onclose: () => void } = $props();

  // svelte-ignore state_referenced_locally
  const form = new FolderEditForm(folder);
  const COLOR_OPTIONS = [{ value: null, label: 'Keine Farbe', hue: null }, ...FOLDER_COLORS];
  const action = new Action();
  // The folder's own visibility stays selectable even if the member could not create it (e.g. coach editing a club folder name).
  // svelte-ignore state_referenced_locally
  const scopes = FOLDER_SCOPES.filter((s) => filePolicy.rootScopes().includes(s.value) || s.value === folder.scope);
  const teams = filePolicy.rootTeams();
  // Teams already on the folder stay listed even if the member could not choose them (e.g. admin-made shared folders).
  // svelte-ignore state_referenced_locally
  const teamList = new TeamListModel(
    async () => [
      ...teams,
      ...folder.teamIds.filter((id) => !teams.some((t) => t.id === id)).map((id) => ({ id, name: directory.teamName(id) ?? 'Team', season: '' })),
    ],
    session,
    null,
    'folder-teams',
  );
  void teamList.load();
  // svelte-ignore state_referenced_locally
  const photos = new Resource(async () => (await filesApi.files(folder.id)).filter((f) => fileTypes.isImage(f.contentType)));
  void photos.load();

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    form.submitted = true;
    if (!form.valid) return;
    if (!form.changed) return onclose();
    const saved = await action.attempt(() => filesApi.updateFolder(folder.id, form.toPatch()));
    if (saved) onsaved(saved);
  }
</script>

<Dialog open wide={form.scope === 'TEAM'} title="Ordner bearbeiten" {onclose}>
  <form class="stack" onsubmit={submit} novalidate>
    <Field label="Name" error={form.error('name')}>
      <!-- svelte-ignore a11y_autofocus -->
      <input bind:value={form.name} maxlength={settings.files.folderNameMaxLength} autofocus required />
    </Field>

    {#if form.canChangeScope}
      <FolderVisibility
        bind:scope={form.scope}
        bind:teamIds={form.teamIds}
        {scopes}
        {teamList}
        error={form.error('team')}
        hintSuffix=" Unterordner und Dateien folgen."
      />
    {:else}
      <p class="small empty">Sichtbar für: {scopeLabel(folder.scope)}. Unterordner übernehmen die Sichtbarkeit vom obersten Ordner.</p>
    {/if}

    <label class="check"><input type="checkbox" bind:checked={form.membersCanUpload} /> Mitglieder dürfen hochladen</label>

    <Field label="Farbe" group>
      <ColorSwatches label="Farbe" options={COLOR_OPTIONS} bind:value={form.color} />
    </Field>

    <fieldset class="group">
      <legend>Titelbild in der Galerie</legend>
      <AsyncView resource={photos}>
        {#snippet children(list)}
          {#if list.length}
            <div class="covers">
              <button
                type="button"
                class="cover none"
                class:chosen={form.coverFileId === null}
                onclick={() => (form.coverFileId = null)}
                aria-pressed={form.coverFileId === null}
                {@attach tooltip('Kein Titelbild')}>Keins</button
              >
              {#each list as photo (photo.id)}
                <button
                  type="button"
                  class="cover"
                  class:chosen={form.coverFileId === photo.id}
                  onclick={() => (form.coverFileId = photo.id)}
                  aria-pressed={form.coverFileId === photo.id}
                  {@attach tooltip(photo.name)}
                >
                  <Thumbnail file={photo} />
                </button>
              {/each}
            </div>
          {:else}
            <p class="small empty">Lade Fotos in diesen Ordner hoch, um eins als Titelbild zu wählen.</p>
          {/if}
        {/snippet}
      </AsyncView>
    </fieldset>

    <ErrorNote error={action.error} />
    <div class="row">
      <Button type="submit" variant="primary" busy={action.busy}>Speichern</Button>
      <Button variant="ghost" onclick={onclose}>Abbrechen</Button>
    </div>
  </form>
</Dialog>

<style>
  .group {
    display: grid;
    gap: var(--space-xs);
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
</style>
