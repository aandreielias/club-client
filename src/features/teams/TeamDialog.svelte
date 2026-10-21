<script lang="ts">
  import { settings } from '../../settings';
  import { session } from '../../lib/container';
  import { Action } from '../../lib/state/Action.svelte';
  import type { Team } from '../../lib/types';
  import Button from '../../ui/Button.svelte';
  import Dialog from '../../ui/Dialog.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import { TeamForm } from './TeamForm.svelte';
  import { teamsApi } from './services';

  /** New team, or rename `team` (name and season). */
  let { team = null, onsaved, onclose }: { team?: Team | null; onsaved: (team: Team) => void; onclose: () => void } = $props();

  const form = new TeamForm(session.clock);
  // svelte-ignore state_referenced_locally
  if (team) Object.assign(form, { name: team.name, season: team.season });
  const action = new Action();

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    form.submitted = true;
    if (!form.valid) return;
    const name = form.name.trim();
    const season = form.season.trim();
    const saved = await action.attempt(() => (team ? teamsApi.update(team.id, { name, season }) : teamsApi.create(name, season)));
    if (saved) onsaved(saved);
  }
</script>

<Dialog open title={team ? 'Team bearbeiten' : 'Neues Team'} {onclose}>
  <form class="stack" onsubmit={submit} novalidate>
    <Field label="Name" error={form.error('name')}>
      <!-- svelte-ignore a11y_autofocus -->
      <input bind:value={form.name} maxlength={settings.teams.nameMaxLength} autofocus required />
    </Field>
    <Field label="Saison" hint="z. B. 2026/27" error={form.error('season')}>
      <input bind:value={form.season} required />
    </Field>
    <ErrorNote error={action.error} />
    <div class="row">
      <Button type="submit" variant="primary" busy={action.busy}>{team ? 'Speichern' : 'Anlegen'}</Button>
      <Button variant="ghost" onclick={onclose}>Abbrechen</Button>
    </div>
  </form>
</Dialog>
