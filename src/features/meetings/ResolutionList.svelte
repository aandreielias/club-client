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
  import { MAJORITY_LABELS, majorities, type Majority, type Meeting, type Resolution } from './model';
  import ResolutionCard from './ResolutionCard.svelte';
  import { meetingsApi } from './services';

  /** The resolutions of a meeting in order, live; who runs the meeting adds motions. */
  let { meeting }: { meeting: Meeting } = $props();

  // svelte-ignore state_referenced_locally
  const list = new Resource(() => meetingsApi.resolutions(meeting.id));
  void list.load();
  useBus(bus, RESOLUTION_CHANGED, ({ data }) => data.meetingId === meeting.id && void list.load());

  const add = new Action();
  // svelte-ignore state_referenced_locally
  const majorityOptions = majorities(meeting.kind).map((m) => ({ value: m, label: MAJORITY_LABELS[m] }));
  let title = $state('');
  let text = $state('');
  // svelte-ignore state_referenced_locally
  let majority = $state<Majority>(majorityOptions[0].value);

  async function create(event: SubmitEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    if (await add.attempt(() => meetingsApi.createResolution(meeting.id, { title: title.trim(), text: text.trim() || null, majority }))) {
      title = '';
      text = '';
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
    {#if majorityOptions.length > 1}
      <Field label="Nötige Mehrheit" hint="Statutenänderung: zwei Drittel; Auflösung: drei Viertel (§ 8 Abs. 9).">
        <Select bind:value={majority} options={majorityOptions} />
      </Field>
    {/if}
    <ErrorNote error={add.error} />
    <div><Button type="submit" busy={add.busy} disabled={!title.trim()}>Antrag hinzufügen</Button></div>
  </form>
{/if}

<style>
  .add {
    margin-top: var(--space-md);
  }
</style>
