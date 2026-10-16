<script lang="ts">
  import Button from '../../ui/Button.svelte';
  import Dialog from '../../ui/Dialog.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
  import TeamPicker from '../../ui/TeamPicker.svelte';
  import { TeamListModel } from '../../lib/directory/TeamListModel.svelte';
  import { session } from '../../lib/container';
  import { settings } from '../../settings';
  import { Action } from '../../lib/state/Action.svelte';
  import { FolderForm } from './FolderForm.svelte';
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
    let created: Folder | null = null;
    await action.run(async () => {
      created = await filesApi.createFolder(form.toNew());
    });
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
      <Field label="Sichtbar für" hint={FOLDER_SCOPES.find((s) => s.value === form.scope)?.hint}>
        <Select bind:value={form.scope} options={scopes} />
      </Field>
      {#if form.scope === 'TEAM'}
        <div class="teams">
          <span class="legend">Teams</span>
          <TeamPicker list={teamList} chosen={form.teamIds} error={form.error('team')}
            ontoggle={(id) => (form.teamIds = form.teamIds.includes(id) ? form.teamIds.filter((t) => t !== id) : [...form.teamIds, id])} />
        </div>
      {/if}
    {/if}
    <label class="check">
      <input type="checkbox" bind:checked={form.membersCanUpload} />
      Alle, die den Ordner sehen, dürfen hochladen
    </label>
    <ErrorNote error={action.error} />
    <div class="row">
      <Button type="submit" variant="primary" busy={action.busy}>Anlegen</Button>
      <Button variant="ghost" onclick={onclose}>Abbrechen</Button>
    </div>
  </form>
</Dialog>

<style>
  .teams {
    display: grid;
    gap: var(--space-xs);
  }
  .legend {
    color: var(--color-text-muted);
    font-size: var(--font-size-small);
    font-weight: var(--font-weight-medium);
  }
  .hint {
    margin: 0;
    font-size: var(--font-size-small);
  }
</style>
