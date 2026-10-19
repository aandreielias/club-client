<script lang="ts">
  import { settings } from '../../settings';
  import { bus, directory, store } from '../../lib/container';
  import { TOAST } from '../../channels';
  import { PersonListModel } from '../../lib/directory/PersonListModel.svelte';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import PeoplePicker from '../../ui/PeoplePicker.svelte';
  import type { FolderContents } from './FolderContents.svelte';
  import type { Folder, StoredFile } from './model';
  import { tagCandidates } from './services';

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
    () => tagCandidates.load(folder),
    directory,
    (id) => selected.includes(id),
    store,
    'photo-tags',
  );
  const loaded = list.load();

  /** A member dragged onto the photo: chosen when they are a candidate here. */
  export async function addPerson(id: string) {
    await loaded;
    if (!list.data.value?.some((p) => p.memberId === id)) bus.publish(TOAST, { text: `${directory.nameOf(id)} kann auf diesem Foto nicht markiert werden.` });
    else if (!selected.includes(id)) selected = [...selected, id];
  }

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
