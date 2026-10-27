<script lang="ts">
  import Button from '../../ui/Button.svelte';
  import Dialog from '../../ui/Dialog.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
  import { TeamListModel } from '../../lib/directory/TeamListModel.svelte';
  import { session } from '../../lib/container';
  import { settings } from '../../settings';
  import { Action } from '../../lib/state/Action.svelte';
  import { FolderForm } from './FolderForm.svelte';
  import FolderVisibility from './FolderVisibility.svelte';
  import { FOLDER_KINDS, FOLDER_SCOPES, type Folder } from './model';
  import { filePolicy, filesApi } from './services';

  let {
    parent,
    oncreated,
    onclose,
  }: { parent: Folder | null; oncreated: (folder: Folder) => void; onclose: () => void } = $props();

  const scopes = FOLDER_SCOPES.filter((s) => filePolicy.rootScopes().includes(s.value));
  const teams = filePolicy.rootTeams();
  // svelte-ignore state_referenced_locally
  const form = new FolderForm(parent, { scope: scopes[0]?.value ?? 'TEAM', teamIds: teams.length === 1 ? [teams[0].id] : [] });
  const teamList = new TeamListModel(async () => [...teams], session, null, 'folder-teams');
  void teamList.load();
  const action = new Action();

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    form.submitted = true;
    if (!form.valid) return;
    const created = await action.attempt(() => filesApi.createFolder(form.toNew()));
    if (created) oncreated(created);
  }
</script>

<Dialog open wide={form.scope === 'TEAM'} title={parent ? `Unterordner in „${parent.name}“` : 'Neuer Ordner'} {onclose}>
  <form class="stack" onsubmit={submit} novalidate>
    <Field label="Name" error={form.error('name')}>
      <!-- svelte-ignore a11y_autofocus -->
      <input bind:value={form.name} maxlength={settings.files.folderNameMaxLength} autofocus required />
    </Field>
    <Field label="Art">
      <Select bind:value={form.kind} options={FOLDER_KINDS} />
    </Field>
    {#if parent}
      <p class="muted hint">Sichtbarkeit und Team übernimmt der Unterordner vom übergeordneten Ordner.</p>
    {:else}
      <FolderVisibility bind:scope={form.scope} bind:teamIds={form.teamIds} {scopes} {teamList} error={form.error('team')} />
    {/if}
    <label class="check">
      <input type="checkbox" bind:checked={form.membersCanUpload} />
      Mitglieder dürfen hochladen
    </label>
    <ErrorNote error={action.error} />
    <div class="row">
      <Button type="submit" variant="primary" busy={action.busy}>Anlegen</Button>
      <Button variant="ghost" onclick={onclose}>Abbrechen</Button>
    </div>
  </form>
</Dialog>

<style>
  .hint {
    margin: 0;
    font-size: var(--font-size-small);
  }
</style>
