<script lang="ts">
  import { bus, session } from '../../lib/container';
  import { TOAST } from '../../channels';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import RecordLink from '../../ui/RecordLink.svelte';
  import Tag from '../../ui/Tag.svelte';
  import { ChangeRequestModel } from './ChangeRequestModel.svelte';
  import { CHANGE_FIELD_LABELS, type ChangeRequest } from './MembersApi';
  import { memberPolicy as policy, membersApi } from './services';

  /** The member's request behind a task: what should change, and the decision for admin/board. */
  let { requestId }: { requestId: string } = $props();

  // svelte-ignore state_referenced_locally
  const model = new ChangeRequestModel(membersApi, requestId);
  void model.load();

  const STATUS = { OPEN: ['Offen', 'warning'], APPROVED: ['Übernommen', 'success'], REJECTED: ['Abgelehnt', 'danger'] } as const;

  const shown = (request: ChangeRequest, value: string | null) =>
    value && request.field === 'BIRTH_DATE' ? session.format.date(value) : (value ?? '–');

  async function decide(approve: boolean) {
    if (await model.decide(approve)) bus.publish(TOAST, { text: approve ? 'Änderung übernommen.' : 'Anfrage abgelehnt.' });
  }
</script>

<h2>Anfrage</h2>
<AsyncView resource={model.request}>
  {#snippet children(request)}
    <dl class="props">
      <dt>Mitglied</dt>
      <dd><RecordLink kind="member" id={request.memberId}>{request.memberName}</RecordLink></dd>
      <dt>{CHANGE_FIELD_LABELS[request.field]}</dt>
      <dd class="change">
        <!-- Once decided, the member's current value is already the new one (or stays as it was). -->
        {#if request.status === 'OPEN'}
          <span class="old">{shown(request, request.currentValue)}</span>
          <span class="muted" aria-hidden="true">→</span>
          <span class="visually-hidden">ändern auf</span>
        {/if}
        <strong>{shown(request, request.newValue)}</strong>
      </dd>
      {#if request.note}
        <dt>Begründung</dt>
        <dd>{request.note}</dd>
      {/if}
      <dt>Status</dt>
      <dd><Tag tone={STATUS[request.status][1]}>{STATUS[request.status][0]}</Tag></dd>
    </dl>
    {#if request.status === 'OPEN' && policy.canDecideChanges()}
      <div class="row">
        <Button variant="primary" busy={model.decideAction.busy} onclick={() => decide(true)}>Annehmen</Button>
        <Button busy={model.decideAction.busy} onclick={() => decide(false)}>Ablehnen</Button>
      </div>
      <ErrorNote error={model.decideAction.error} />
    {/if}
  {/snippet}
</AsyncView>

<style>
  .change {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-xs) var(--space-sm);
  }
  .old {
    color: var(--color-text-muted);
    text-decoration: line-through;
  }
</style>
