<script lang="ts">
  import { bus, directory } from '../../lib/container';
  import { TOAST } from '../../channels';
  import { Resource } from '../../lib/state/Resource.svelte';
  import { TEAM_ROLE_LABELS, type TeamRole } from '../../lib/types';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
  import type { RosterModel } from './RosterModel.svelte';

  /** Admin/board: pick an active member who is not in the team yet. Loading the list may ask for the PIN. */
  let { model, onclose }: { model: RosterModel; onclose: () => void } = $props();

  const members = new Resource(() => directory.allMembers());
  let memberId = $state('');
  let role = $state<TeamRole>('PLAYER');

  void members.load();

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!memberId) return;
    if (await model.assign(memberId, role)) {
      bus.publish(TOAST, { text: 'Zum Team hinzugefügt.' });
      memberId = '';
    }
  }
</script>

<AsyncView resource={members}>
  {#snippet children(all)}
    {@const candidates = all.filter((m) => m.active && !model.has(m.id))}
    <form class="add" onsubmit={submit}>
      <Field label="Mitglied">
        <Select
          bind:value={memberId}
          placeholder="Bitte wählen"
          options={candidates.map((m) => ({ value: m.id, label: `${m.lastName}, ${m.firstName}` }))}
        />
      </Field>
      <Field label="Rolle im Team">
        <Select bind:value={role} options={Object.entries(TEAM_ROLE_LABELS).map(([value, label]) => ({ value, label }))} />
      </Field>
      <div class="row">
        <Button type="submit" variant="primary" busy={model.assignAction.busy} disabled={!memberId}>Hinzufügen</Button>
        <Button variant="ghost" onclick={onclose}>Schließen</Button>
      </div>
    </form>
  {/snippet}
</AsyncView>
<ErrorNote error={model.assignAction.error} />

<style>
  .add {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    gap: var(--space-md);
    align-items: end;
  }
</style>
