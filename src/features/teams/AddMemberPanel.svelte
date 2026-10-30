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
  import { memberPolicy, membersApi } from '../members/services';
  import type { RosterModel } from './RosterModel.svelte';

  /** Admin/board: pick an active member who is not in the team yet. Loading the list may ask for the PIN. */
  let { model, onclose }: { model: RosterModel; onclose: () => void } = $props();

  const members = new Resource(() => directory.allMembers());
  let memberId = $state('');
  let role = $state<TeamRole>('PLAYER');
  /** A team coach without the COACH role can't plan the team's appointments; admins grant it right here. */
  let grantCoach = $state(true);
  const picked = $derived((members.value ?? []).find((m) => m.id === memberId) ?? null);
  const needsCoach = $derived(role === 'COACH' && !!picked && !picked.roles.includes('COACH'));
  const mayGrant = $derived(!!picked && memberPolicy.canSetRoles(picked));

  void members.load();

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!memberId) return;
    const coach = needsCoach && mayGrant && grantCoach ? picked : null;
    if (await model.assign(memberId, role)) {
      if (coach && !(await model.assignAction.run(() => membersApi.setRoles(coach.id, [...coach.roles, 'COACH'])))) return;
      bus.publish(TOAST, { text: coach ? 'Zum Team hinzugefügt, Rolle Trainer:in vergeben.' : 'Zum Team hinzugefügt.' });
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
      {#if needsCoach}
        {#if mayGrant}
          <label class="check"><input type="checkbox" bind:checked={grantCoach} /> Auch die Rolle Trainer:in geben</label>
        {:else}
          <p class="muted small">Ohne die Rolle Trainer:in plant das Mitglied keine Termine; die Rolle vergibt ein Admin.</p>
        {/if}
      {/if}
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
