<script lang="ts">
  import { Resource } from '../../lib/state/Resource.svelte';
  import { permissions } from '../../lib/container';
  import Button from '../../ui/Button.svelte';
  import Field from '../../ui/Field.svelte';
  import RecordLink from '../../ui/RecordLink.svelte';
  import MemberChips from './MemberChips.svelte';
  import type { MeetingModel } from './MeetingModel.svelte';
  import { activePeople } from './people';
  import type { Chosen, Meeting, MeetingType } from './model';

  /**
   * Who a meeting of a CHOSEN type invites: members, guests from outside (name and e-mail, invited by mail) and the parties in dispute,
   * who never see it (server: setInvitees). Who runs it changes them until it opens.
   */
  let { meeting, chosen, type, model }: { meeting: Meeting; chosen: Chosen; type: MeetingType | undefined; model: MeetingModel } = $props();

  const people = new Resource(activePeople);
  let editing = $state(false);
  let memberIds = $state<string[]>([]);
  let partyIds = $state<string[]>([]);
  let guests = $state<{ id: string | null; name: string; email: string }[]>([]);

  const editable = $derived(meeting.canManage && (meeting.status === 'DRAFT' || meeting.status === 'INVITED'));
  const count = $derived(chosen.members.length + chosen.guests.length);
  const bounds = $derived(
    !type || (!type.minInvitees && !type.maxInvitees)
      ? null
      : type.minInvitees === type.maxInvitees
        ? `genau ${type.minInvitees}`
        : `${type.minInvitees ?? 1} bis ${type.maxInvitees ?? 'beliebig viele'}`,
  );

  function start() {
    void people.load();
    memberIds = chosen.members.map((p) => p.memberId);
    partyIds = chosen.parties.map((p) => p.memberId);
    guests = chosen.guests.map((g) => ({ id: g.id, name: g.name, email: g.email ?? '' }));
    editing = true;
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    const given = guests.map((g) => ({ ...g, name: g.name.trim(), email: g.email.trim() })).filter((g) => g.name || g.email);
    if (await model.setInvitees({ memberIds, partyIds, guests: given })) editing = false;
  }
</script>

<h2>Eingeladene</h2>
{#if editing}
  <form class="stack" onsubmit={save} novalidate>
    <MemberChips
      bind:value={memberIds}
      candidates={(people.value ?? []).filter((p) => !partyIds.includes(p.memberId))}
      known={chosen.members}
      label="Eingeladene Mitglieder"
      placeholder="Mitglied einladen"
    />
    <Field label="Gäste von außerhalb" hint="Bekommen Einladung und Änderungen per E-Mail; stimmen per Handzeichen ab." group>
      <div class="stack">
        {#each guests as guest, i (guest.id ?? `neu-${i}`)}
          <div class="row">
            <input bind:value={guest.name} maxlength="100" placeholder="Name" aria-label="Name des Gasts" />
            <input type="email" bind:value={guest.email} maxlength="200" placeholder="E-Mail" aria-label="E-Mail des Gasts" />
            <Button size="sm" variant="ghost" icon="delete" tooltip="Gast entfernen" onclick={() => guests.splice(i, 1)} />
          </div>
        {/each}
        <div><Button size="sm" icon="add" onclick={() => guests.push({ id: null, name: '', email: '' })}>Gast hinzufügen</Button></div>
      </div>
    </Field>
    <MemberChips
      bind:value={partyIds}
      candidates={(people.value ?? []).filter((p) => !memberIds.includes(p.memberId))}
      known={chosen.parties}
      label="Streitparteien"
      placeholder="Streitpartei hinzufügen"
    />
    <p class="muted small">Streitparteien sehen die Sitzung nicht und können nicht eingeladen werden.</p>
    <div class="row">
      <Button type="submit" variant="primary" busy={model.action.busy}>Speichern</Button>
      <Button variant="ghost" onclick={() => (editing = false)}>Abbrechen</Button>
    </div>
  </form>
{:else}
  <ul class="rows">
    {#each chosen.members as p (p.memberId)}
      <li><RecordLink kind="member" id={p.memberId} allowed={permissions.canSeeMember(p.memberId)}>{p.name}</RecordLink></li>
    {/each}
    {#each chosen.guests as g (g.id)}
      <li>{g.name} <span class="muted small">Gast{g.email ? ` · ${g.email}` : ''}</span></li>
    {/each}
    {#if !count}<li class="muted">Noch niemand eingeladen.</li>{/if}
  </ul>
  {#if bounds}<p class="muted small" class:late={count < (type?.minInvitees ?? 1) || (!!type?.maxInvitees && count > type.maxInvitees)}>
      {count} eingeladen · nötig: {bounds}
    </p>{/if}
  {#if chosen.parties.length}
    <p class="small">Streitparteien: {chosen.parties.map((p) => p.name).join(', ')}</p>
  {/if}
  {#if editable}
    <div><Button size="sm" icon="edit" tooltip="Eingeladene, Gäste und Streitparteien ändern" onclick={start}>Eingeladene bearbeiten</Button></div>
  {/if}
{/if}

<style>
  .late {
    color: var(--color-danger);
  }
</style>
