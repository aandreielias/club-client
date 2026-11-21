<script lang="ts">
  import { HONORARY } from './MembersApi';
  import { backStack, bus, commands, session } from '../../lib/container';
  import { DetailController } from '../../lib/detail/DetailController.svelte';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import { LIVE_RESYNC } from '../../lib/live/LiveUpdates.svelte';
  import { MEMBER_CHANGED } from './events';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import { useRecordActions } from '../../lib/actions/useRecordActions.svelte';
  import RecordActionButtons from '../../ui/RecordActionButtons.svelte';
  import { memberActions } from './actions';
  import { displayName, ROLE_LABELS, roleHue, type Member, type Role } from '../../lib/types';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Detail from '../../ui/Detail.svelte';
  import Tag from '../../ui/Tag.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import FamilySection from './FamilySection.svelte';
  import GuardianLinker from './GuardianLinker.svelte';
  import HeldItemsSection from './HeldItemsSection.svelte';
  import MyFeesSection from '../finance/MyFeesSection.svelte';
  import MemberAbsencesSection from '../calendar/MemberAbsencesSection.svelte';
  import MembershipEditor from './MembershipEditor.svelte';
  import { MemberDetailModel } from './MemberDetailModel.svelte';
  import ProfileEditor from './ProfileEditor.svelte';
  import RoleChecklist from './RoleChecklist.svelte';
  import { memberPolicy as policy, membersApi, membershipKinds } from './services';

  /** One member: profile, roles, guardians, access. Window and page. */
  let { id, handle }: { id: string; handle?: WindowHandle } = $props();

  // svelte-ignore state_referenced_locally
  const model = new MemberDetailModel(membersApi, id);
  void model.load();
  if (policy.canInvite()) void model.invitationPending.load();
  const invited = $derived(!!model.invitationPending.value);

  // svelte-ignore state_referenced_locally
  const view = new DetailController(bus, handle);
  view.title(() => model.member.value && displayName(model.member.value));

  let editing = $state(false);
  backStack.while(
    () => editing,
    () => (editing = false),
  );
  useBus(bus, MEMBER_CHANGED, ({ data }) => data.memberId === id && !editing && void model.load());
  useBus(bus, LIVE_RESYNC, () => !editing && void model.load());
  useCommands(commands, {
    'record.edit': { run: () => (editing = true), when: () => !editing && !!model.member.value && policy.canEditProfile(model.member.value) },
  });
  let roles = $state<Role[]>([]);
  let rolesFor = $state<string | null>(null);

  // Role draft follows the loaded member until the admin starts changing it.
  $effect(() => {
    const member = model.member.value;
    if (member && rolesFor !== member.id + member.roles.join()) {
      roles = [...member.roles];
      rolesFor = member.id + member.roles.join();
    }
  });

  const rolesChanged = $derived(!!model.member.value && [...roles].sort().join() !== [...model.member.value.roles].sort().join());

  async function saveRoles(member: Member) {
    if (await model.setRoles(roles)) {
      view.notify('Rollen gespeichert.');
      if (policy.isSelf(member)) await session.loadMe();
    }
  }

  const mayInviteLogin = $derived(!!model.member.value && !model.member.value.login && model.member.value.active && policy.canInvite());

  const act = useRecordActions(
    commands,
    memberActions,
    () => (!editing && model.member.value ? { member: model.member.value, invited } : null),
    () => view.leave(),
    () => Promise.all([model.load(), policy.canInvite() && model.invitationPending.load()]),
  );
</script>

<AsyncView resource={model.member}>
  {#snippet children(member)}
    <Detail title={editing ? 'Profil bearbeiten' : [member.firstName, member.middleName, member.lastName].filter(Boolean).join(' ')}>
      {#snippet actions()}
        <RecordActionButtons actions={act} />
      {/snippet}
      {#snippet meta()}
        {#if !member.active}<Tag tone="red">Inaktiv</Tag>{:else if !member.login}<Tag>Ohne Login</Tag>{:else if invited}<Tag>Eingeladen</Tag>{/if}
        {#if member.membershipTypes.includes(HONORARY)}<Tag tone="yellow">{membershipKinds.label(HONORARY)}</Tag>{/if}
        {#each member.roles as role (role)}<Tag tone={roleHue(role)}>{ROLE_LABELS[role]}</Tag>{/each}
      {/snippet}

      {#if editing}
        <ProfileEditor {member} {model} ondone={() => (editing = false)} />
      {:else}
        <dl class="props">
          <dt>Private E-Mail</dt>
          <dd>
            {#if member.email}<a href="mailto:{member.email}">{member.email}</a>{:else}–{/if}
          </dd>
          <dt>Telefon</dt>
          <dd>
            {#if member.phone}<a href="tel:{member.phone}">{member.phone}</a>{:else}–{/if}
          </dd>
          <dt>Geburtsdatum</dt>
          <dd>{member.birthDate ? session.format.date(member.birthDate) : '–'}</dd>
          <dt>Foto-Einwilligung</dt>
          <dd>{member.photoConsent ? 'Ja' : 'Nein'}</dd>
          <!-- Who sets the membership sees it in the form below. -->
          {#if !policy.canSetMembership(member)}
            <dt>Mitgliedschaft</dt>
            <dd>{membershipKinds.text(member)}</dd>
            {#if member.memberSince}
              <dt>Mitglied seit</dt>
              <dd>{session.format.date(member.memberSince)}</dd>
            {/if}
          {/if}
        </dl>
        {#key member.id}<FamilySection
            memberId={member.id}
            firstName={member.firstName}
            self={policy.isSelf(member)}
            parent={member.roles.includes('PARENT')}
          />{/key}
        <HeldItemsSection memberId={member.id} />
        {#key member.id}<MemberAbsencesSection memberId={member.id} />{/key}
        {#key member.id}<MyFeesSection memberId={member.id} history />{/key}
      {/if}

      {#if policy.canSetMembership(member) && !editing}
        <h2>Mitgliedschaft</h2>
        {#key member.id + member.membershipTypes.join() + member.memberSince}<MembershipEditor {member} {model} />{/key}
      {/if}

      {#if policy.canSetRoles(member)}
        <h2>Rollen</h2>
        <div class="stack">
          <RoleChecklist bind:value={roles} allowed={policy.grantableRoles()} legend="Rollen im Verein" />
          <p class="muted small">Die Vorstandsrolle kommt mit einer Funktion auf der Seite <a href="/board">Vorstand</a>.</p>
          {#if policy.isSelf(member)}<p class="muted small">Die eigene Admin-Rolle lässt sich nicht entfernen.</p>{/if}
          <ErrorNote error={model.rolesAction.error} />
          <div>
            <Button variant="primary" busy={model.rolesAction.busy} disabled={!rolesChanged} onclick={() => saveRoles(member)}
              >Rollen speichern</Button
            >
          </div>
        </div>
      {/if}

      {#if policy.canLinkGuardian(member)}
        <h2>Erziehungsberechtigte</h2>
        <GuardianLinker {member} {model} />
      {/if}

      {#if mayInviteLogin || (invited && member.active)}
        <h2>Zugang</h2>
        {#if mayInviteLogin}
          <p class="muted small">
            Ohne eigenen Login: Erziehungsberechtigte bekommen die Nachrichten.{member.email
              ? ''
              : ' Für einen Login zuerst unter „Profil bearbeiten“ eine E-Mail eintragen.'}
          </p>
        {:else if invited && member.active}
          <p class="muted small">Noch nicht angemeldet. Der Link in der Einladung gilt nur eine Zeit lang.</p>
        {/if}
      {/if}
    </Detail>
  {/snippet}
</AsyncView>
