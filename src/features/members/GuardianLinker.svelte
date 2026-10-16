<script lang="ts">
  import { bus, directory } from '../../lib/container';
  import { TOAST } from '../../channels';
  import { Resource } from '../../lib/state/Resource.svelte';
  import type { Member } from '../../lib/types';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
  import type { MemberDetailModel } from './MemberDetailModel.svelte';

  /** Links a guardian (e.g. a parent) to this member. The server offers no list of existing links. */
  let { member, model }: { member: Member; model: MemberDetailModel } = $props();

  const candidates = new Resource(() => directory.allMembers());
  void candidates.load();
  let guardianId = $state('');

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (guardianId && (await model.linkGuardian(guardianId))) {
      bus.publish(TOAST, { text: 'Erziehungsberechtigte:r zugeordnet.' });
      guardianId = '';
    }
  }
</script>

<AsyncView resource={candidates}>
  {#snippet children(all)}
    <form class="link" onsubmit={submit}>
      <Field label="Erziehungsberechtigte:r">
        <Select bind:value={guardianId} placeholder="Bitte wählen"
          options={all.filter((m) => m.active && m.id !== member.id).map((m) => ({ value: m.id, label: `${m.lastName}, ${m.firstName}` }))} />
      </Field>
      <div><Button type="submit" busy={model.guardianAction.busy} disabled={!guardianId}>Zuordnen</Button></div>
    </form>
    <p class="muted small hint">Sieht danach Termine, Aufgaben und das Geburtsdatum von {member.firstName}.</p>
  {/snippet}
</AsyncView>
<ErrorNote error={model.guardianAction.error} />

<style>
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
