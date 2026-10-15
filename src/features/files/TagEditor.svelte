<script lang="ts">
  import { untrack } from 'svelte';
  import { settings } from '../../settings';
  import { directory, permissions, session } from '../../lib/container';
  import { Resource } from '../../lib/state/Resource.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
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

  const candidates = new Resource(async () => {
    if (folder.teamId) return directory.candidates(folder.teamId);
    if (permissions.isManager) return directory.candidates(null);
    const rosters = await Promise.all(session.teams.map((t) => directory.roster(t.id)));
    const unique = new Map(rosters.flatMap((r) => r?.entries ?? []).map((e) => [e.memberId, e] as const));
    return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
  });
  untrack(() => candidates.load());

  function toggle(id: string) {
    selected = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
  }

  async function save() {
    const updated = await contents.tag(file, selected);
    if (updated) ondone(updated);
  }
</script>

<div class="stack">
  <AsyncView resource={candidates}>
    {#snippet children(list)}
      <ul class="options">
        {#each list as candidate (candidate.memberId)}
          <li>
            <label>
              <input type="checkbox" checked={selected.includes(candidate.memberId)} onchange={() => toggle(candidate.memberId)}
                disabled={!selected.includes(candidate.memberId) && selected.length >= settings.files.maxTags} />
              {candidate.name}
            </label>
          </li>
        {/each}
      </ul>
    {/snippet}
  </AsyncView>
  <p class="muted hint">Nur Personen mit Foto-Einwilligung können markiert werden.</p>
  <ErrorNote error={contents.tagAction.error} />
  <div><Button variant="primary" busy={contents.tagAction.busy} onclick={save}>Markierungen speichern</Button></div>
</div>

<style>
  .options {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
    gap: var(--space-xs) var(--space-md);
    max-height: 14rem;
    overflow-y: auto;
  }
  label {
    display: flex;
    align-items: baseline;
    gap: var(--space-sm);
  }
  .hint {
    margin: 0;
    font-size: var(--font-size-small);
  }
</style>
