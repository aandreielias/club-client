<script lang="ts">
  import { bus } from '../../lib/container';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import { Action } from '../../lib/state/Action.svelte';
  import { Resource } from '../../lib/state/Resource.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
  import { RESOLUTION_CHANGED } from './events';
  import { directory } from '../../lib/container';
  import type { OfficeKind } from '../members/MembersApi';
  import { boardSettings } from '../members/services';
  import MemberChips from './MemberChips.svelte';
  import {
    ACTION_LABELS,
    actionNeedsMember,
    actions,
    MAJORITY_LABELS,
    majorities,
    type Majority,
    type Meeting,
    type Resolution,
    type ResolutionAction,
  } from './model';
  import ResolutionCard from './ResolutionCard.svelte';
  import { meetingsApi, meetingTypes, resolutionRules } from './services';

  /** The resolutions of a meeting in order, live; who runs the meeting adds motions. */
  let { meeting }: { meeting: Meeting } = $props();

  // svelte-ignore state_referenced_locally
  const list = new Resource(() => meetingsApi.resolutions(meeting.id));
  void list.load();
  useBus(bus, RESOLUTION_CHANGED, ({ data }) => data.meetingId === meeting.id && void list.load());

  const add = new Action();
  // svelte-ignore state_referenced_locally
  const majorityOptions = majorities(meetingTypes.get(meeting.kind) ?? null).map((m) => ({ value: m, label: MAJORITY_LABELS[m] }));
  let title = $state('');
  let text = $state('');
  // svelte-ignore state_referenced_locally
  let majority = $state<Majority>(majorityOptions[0].value);
  // svelte-ignore state_referenced_locally
  const actionOptions = actions(meetingTypes.get(meeting.kind) ?? null)
    .filter((a) => resolutionRules.enabled(a))
    .map((a) => ({ value: a, label: ACTION_LABELS[a] }));
  let action = $state<ResolutionAction>('GENERAL');
  let actionMemberId = $state('');
  let actionOffice = $state<OfficeKind | ''>('');
  let assignees = $state<string[]>([]);
  const officeOptions = boardSettings.enabled.map((o) => ({ value: o, label: boardSettings.label(o) }));
  const members = new Resource(() => directory.allMembers());
  void members.load();
  // Elections need someone who may be elected; the other actions any active member.
  const memberOptions = $derived(
    (members.value ?? [])
      .filter((m) => (action === 'ELECTION' ? m.eligible : m.active))
      .map((m) => ({ value: m.id, label: `${m.lastName}, ${m.firstName}` })),
  );
  const implied = $derived(resolutionRules.fixedMajority(action));
  // server: ResolutionHandlers.assignable — those present; admins and board members only when its tasks need their rights.
  const candidates = $derived(meeting.assignable.filter((p) => action === 'GENERAL' || p.manager));
  $effect(() => {
    // Changing the action may drop chosen people who cannot do its tasks.
    const allowed = candidates.map((c) => c.memberId);
    if (assignees.some((id) => !allowed.includes(id))) assignees = assignees.filter((id) => allowed.includes(id));
  });
  const ready = $derived(!!title.trim() && (!actionNeedsMember(action) || !!actionMemberId) && (action !== 'ELECTION' || !!actionOffice));

  async function create(event: SubmitEvent) {
    event.preventDefault();
    if (!ready) return;
    const resolution = {
      title: title.trim(),
      text: text.trim() || null,
      majority: implied ? null : majority,
      action,
      actionMemberId: actionNeedsMember(action) ? actionMemberId : null,
      actionOffice: action === 'ELECTION' && actionOffice ? actionOffice : null,
      assigneeIds: assignees,
    };
    if (await add.attempt(() => meetingsApi.createResolution(meeting.id, resolution))) {
      title = '';
      text = '';
      action = 'GENERAL';
      actionMemberId = '';
      actionOffice = '';
      assignees = [];
      void list.load();
    }
  }

  const replace = (updated: Resolution) => list.set((list.value ?? []).map((r) => (r.id === updated.id ? updated : r)));
</script>

<AsyncView resource={list}>
  {#snippet children(items)}
    <div class="stack">
      {#each items as r (r.id)}
        <ResolutionCard resolution={r} onchanged={replace} ondeleted={() => void list.load()} />
      {:else}
        <p class="muted">Noch keine Beschlüsse.</p>
      {/each}
    </div>
  {/snippet}
</AsyncView>

{#if meeting.canManage && meeting.status !== 'CLOSED'}
  <form class="stack add" onsubmit={create}>
    <Field label="Neuer Antrag">
      <input bind:value={title} maxlength="200" placeholder="z. B. Mitgliedsbeitrag 2027: 60 €" />
    </Field>
    <Field label="Text (optional)">
      <textarea bind:value={text} rows="3" maxlength="4000"></textarea>
    </Field>
    {#if actionOptions.length > 1}
      <Field label="Art des Beschlusses" hint="Bestimmt die Aufgaben, die nach der Annahme entstehen.">
        <Select bind:value={action} options={actionOptions} />
      </Field>
    {/if}
    {#if actionNeedsMember(action)}
      <Field label={action === 'ELECTION' ? 'Gewählt wird' : 'Betrifft'}>
        <Select bind:value={actionMemberId} placeholder="Bitte wählen" options={memberOptions} />
      </Field>
    {/if}
    {#if action === 'ELECTION'}
      <Field label="Funktion">
        <Select bind:value={actionOffice} placeholder="Bitte wählen" options={officeOptions} />
      </Field>
    {/if}
    {#if implied}
      <p class="muted small">Nötige Mehrheit: {MAJORITY_LABELS[implied]}.</p>
    {:else if majorityOptions.length > 1}
      <Field label="Nötige Mehrheit" hint="Manche Beschlüsse haben eine feste Mehrheit (Einstellungen › Beschlüsse).">
        <Select bind:value={majority} options={majorityOptions} />
      </Field>
    {/if}
    <MemberChips bind:value={assignees} {candidates} label="Verantwortlich für die Umsetzung" placeholder="Verantwortlich (leer = Vorstand)" />
    <ErrorNote error={add.error} />
    <div><Button type="submit" busy={add.busy} disabled={!ready}>Antrag hinzufügen</Button></div>
  </form>
{/if}

<style>
  .add {
    margin-top: var(--space-md);
  }
</style>
