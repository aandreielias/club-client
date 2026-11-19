<script lang="ts">
  import type { TeamListModel } from '../../lib/directory/TeamListModel.svelte';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
  import TeamPicker from '../../ui/TeamPicker.svelte';
  import { boardSettings } from '../members/services';
  import { FOLDER_SCOPES, type FolderScope } from './model';

  /** Who sees a top-level folder: a scope, for TEAM the teams, for OFFICE the office. */
  let {
    scope = $bindable(),
    teamIds = $bindable(),
    office = $bindable(),
    scopes,
    teamList,
    error,
    officeError = null,
    hintSuffix = '',
  }: {
    scope: FolderScope;
    teamIds: string[];
    office: string | null;
    scopes: typeof FOLDER_SCOPES;
    teamList: TeamListModel;
    error?: string | null;
    officeError?: string | null;
    /** Appended to the scope's hint, e.g. what happens to subfolders. */
    hintSuffix?: string;
  } = $props();

  void boardSettings.load();
  const offices = $derived(boardSettings.enabled.map((k) => ({ value: k, label: boardSettings.label(k) })));
  const hint = $derived(`${FOLDER_SCOPES.find((s) => s.value === scope)?.hint ?? ''}${hintSuffix}`);
</script>

<Field label="Sichtbar für" {hint}>
  <Select bind:value={scope} options={scopes} />
</Field>
{#if scope === 'OFFICE'}
  <Field label="Amt" error={officeError}>
    <Select bind:value={() => office ?? '', (v) => (office = v || null)} options={[{ value: '', label: 'Amt wählen' }, ...offices]} />
  </Field>
{/if}
{#if scope === 'TEAM'}
  <div class="teams">
    <span class="legend">Teams</span>
    <TeamPicker
      list={teamList}
      chosen={teamIds}
      {error}
      ontoggle={(id) => (teamIds = teamIds.includes(id) ? teamIds.filter((t) => t !== id) : [...teamIds, id])}
    />
  </div>
{/if}

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
</style>
