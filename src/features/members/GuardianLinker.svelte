<script lang="ts">
  import { bus, directory } from '../../lib/container';
  import { TOAST } from '../../channels';
  import { Resource } from '../../lib/state/Resource.svelte';
  import type { Member } from '../../lib/types';
  import type { GuardianRef } from './MembersApi';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
  import type { MemberDetailModel } from './MemberDetailModel.svelte';
  import { membersApi } from './services';

  /** The member's guardians (e.g. parents): linked ones with "Entfernen", and a picker to link another. */
  let { member, model }: { member: Member; model: MemberDetailModel } = $props();

  const candidates = new Resource(() => directory.allMembers());
  void candidates.load();
  // svelte-ignore state_referenced_locally
  const linked = new Resource(() => membersApi.guardians(member.id));
  void linked.load();
  let guardianId = $state('');

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (guardianId && (await model.linkGuardian(guardianId))) {
      bus.publish(TOAST, { text: 'Erziehungsberechtigte:r zugeordnet.' });
      guardianId = '';
      void linked.load();
    }
  }

  async function unlink(guardian: GuardianRef) {
    if (await model.unlinkGuardian(guardian.memberId)) {
      bus.publish(TOAST, { text: `${guardian.name} ist nicht mehr zugeordnet.` });
      void linked.load();
    }
  }
</script>

{#if linked.value?.length}
  <ul class="linked">
    {#each linked.value as guardian (guardian.memberId)}
      <li>
        <span>{guardian.name}</span>
        <Button size="sm" variant="ghost" busy={model.guardianAction.busy} onclick={() => unlink(guardian)}>Entfernen</Button>
      </li>
    {/each}
  </ul>
{/if}
<AsyncView resource={candidates}>
  {#snippet children(all)}
    <form class="link" onsubmit={submit}>
      <Field label="Erziehungsberechtigte:r">
        <Select
          bind:value={guardianId}
          placeholder="Bitte wählen"
          options={all
            .filter((m) => m.active && m.id !== member.id && !linked.value?.some((g) => g.memberId === m.id))
            .map((m) => ({ value: m.id, label: `${m.lastName}, ${m.firstName}` }))}
        />
      </Field>
      <div><Button type="submit" busy={model.guardianAction.busy} disabled={!guardianId}>Zuordnen</Button></div>
    </form>
    <p class="muted small hint">Sieht danach Termine, Aufgaben und das Geburtsdatum von {member.firstName}.</p>
  {/snippet}
</AsyncView>
<ErrorNote error={model.guardianAction.error} />

<style>
  .linked {
    display: grid;
    margin: 0 0 var(--space-md);
    padding: 0;
    list-style: none;
  }
  .linked li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
    min-height: var(--control-height);
    border-bottom: 1px solid var(--color-border);
  }
  .link {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--space-md);
    align-items: end;
  }
  .hint {
    margin: var(--space-xs) 0 0;
  }
  :global([data-layout='compact']) .link {
    grid-template-columns: 1fr;
  }
</style>
