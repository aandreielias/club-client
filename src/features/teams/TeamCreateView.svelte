<script lang="ts">
  import { bus, directory, session } from '../../lib/container';
  import { CreateController } from '../../lib/detail/CreateController.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import Detail from '../../ui/Detail.svelte';
  import { TEAMS_CHANGED } from './events';
  import TeamEditor from './TeamEditor.svelte';
  import { TeamForm } from './TeamForm.svelte';
  import { teamsApi } from './services';

  /** New team in the window; afterwards the window shows it. */
  let { handle }: { id: string; handle: WindowHandle } = $props();

  const form = new TeamForm(session.clock, session.club?.seasonStartMonth ?? 7);
  // svelte-ignore state_referenced_locally
  const create = new CreateController(bus, handle, 'Neues Team');

  const submit = () =>
    create.submit(
      async () => {
        const team = await teamsApi.create(form.name.trim(), form.season.trim());
        directory.forgetTeams();
        bus.publish(TEAMS_CHANGED);
        return team.id;
      },
      'team',
      'Team angelegt.',
    );
</script>

<Detail title="Neues Team">
  <TeamEditor {form} action={create.save} submitLabel="Anlegen" oncancel={() => handle.close()} onsubmit={submit} />
</Detail>
