<script lang="ts">
  import { settings } from '../../settings';
  import { directory, permissions, session, store } from '../../lib/container';
  import { PersonListModel } from '../../lib/directory/PersonListModel.svelte';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import PeoplePicker from '../../ui/PeoplePicker.svelte';
  import type { FolderContents } from './FolderContents.svelte';
  import type { Folder, StoredFile } from './model';

  /**
   * Marks members on a photo. Candidates: the folder's team, or for club folders the member list
   * (admin/board) or the member's own teams. Members without photo consent are refused by the server.
   */
  let {
    file,
    folder,
    contents,
    ondone,
  }: { file: StoredFile; folder: Folder; contents: FolderContents; ondone: (updated: StoredFile) => void } = $props();

  // svelte-ignore state_referenced_locally
  let selected = $state<string[]>([...file.taggedMemberIds]);

  // svelte-ignore state_referenced_locally
  const list = new PersonListModel(
    async () => {
      await directory.loadRosters(); // team column and filter
      if (folder.teamId) return directory.candidates(folder.teamId);
      if (permissions.isManager) return directory.candidates(null);
      const rosters = await Promise.all(session.teams.map((t) => directory.roster(t.id)));
      const unique = new Map(rosters.flatMap((r) => r?.entries ?? []).map((e) => [e.memberId, e] as const));
      return [...unique.values()];
    },
    directory,
    (id) => selected.includes(id),
    store,
    'photo-tags',
  );
  void list.load();

  function toggle(id: string) {
    selected = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
  }

  async function save() {
    const updated = await contents.tag(file, selected);
    if (updated) ondone(updated);
  }
</script>

<div class="stack">
  <PeoplePicker {list} chosen={selected} ontoggle={toggle} max={settings.files.maxTags} />
  <p class="muted hint">Nur Personen mit Foto-Einwilligung können markiert werden.</p>
  <ErrorNote error={contents.tagAction.error} />
  <div><Button variant="primary" busy={contents.tagAction.busy} onclick={save}>Markierungen speichern</Button></div>
</div>

<style>
  .hint {
    margin: 0;
    font-size: var(--font-size-small);
  }
</style>
