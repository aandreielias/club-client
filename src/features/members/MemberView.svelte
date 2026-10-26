<script lang="ts">
  import { backStack, bus, commands, session } from '../../lib/container';
  import { DetailController } from '../../lib/detail/DetailController.svelte';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import { ROLE_LABELS, type Member, type Role } from '../../lib/types';
  import { roleHue } from './roles';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Detail from '../../ui/Detail.svelte';
  import Tag from '../../ui/Tag.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import FamilySection from './FamilySection.svelte';
  import GuardianLinker from './GuardianLinker.svelte';
  import HeldItems from './HeldItems.svelte';
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

  // svelte-ignore state_referenced_locally
  const view = new DetailController(bus, handle);
  view.title(() => model.member.value && `${model.member.value.firstName} ${model.member.value.lastName}`);

  let editing = $state(false);
  backStack.while(() => editing, () => (editing = false));
  useCommands(commands, {
    'member.edit': { run: () => (editing = true), when: () => !editing && !!model.member.value && policy.canEditProfile(model.member.value) },
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

  const rolesChanged = $derived(
    !!model.member.value && [...roles].sort().join() !== [...model.member.value.roles].sort().join(),
  );

  async function saveRoles(member: Member) {
    if (await model.setRoles(roles)) {
      view.notify('Rollen gespeichert.');
      if (policy.isSelf(member)) await session.loadMe();
    }
  }

  async function resetSecurity(member: Member) {
    const request = {
      title: 'Sperre aufheben und Geräte entfernen',
      message: `${member.firstName} ${member.lastName} kann den Vereins-PIN wieder eingeben. Face-ID-Geräte und laufende Bestätigungen werden entfernt.`,
      confirmLabel: 'Aufheben und entfernen',
      danger: true,
    };
    await view.confirm(request, () => view.attempt(model.resetAction, () => model.resetSecurity()), 'Sperre aufgehoben, Geräte entfernt.');
  }

  async function reactivate(member: Member) {
    const request = { title: 'Mitglied reaktivieren', message: `${member.firstName} ${member.lastName} kann sich wieder anmelden. Teams und Rollen bitte neu zuordnen.`, confirmLabel: 'Reaktivieren' };
    await view.confirm(request, () => view.attempt(model.reactivateAction, () => model.reactivate()), 'Mitglied reaktiviert.');
  }

  async function erase(member: Member) {
    const request = {
      title: 'Personendaten löschen (DSGVO)',
      message: `Name, E-Mail, Telefon, Geburtsdatum und Login von ${member.firstName} ${member.lastName} werden endgültig gelöscht, ebenso Erziehungsberechtigte, Benachrichtigungen und Foto-Markierungen. Einträge wie Aufgaben oder Dateien bleiben, ohne Namen. Das lässt sich nicht rückgängig machen.`,
      confirmLabel: 'Endgültig löschen',
      danger: true,
    };
    await view.confirm(request, () => view.attempt(model.eraseAction, () => model.erase()), 'Personendaten gelöscht.');
  }

  async function deactivate(member: Member) {
    const request = {
      title: 'Mitglied deaktivieren',
      message: `${member.firstName} ${member.lastName} kann sich danach nicht mehr anmelden und wird aus allen Teams entfernt.`,
      confirmLabel: 'Deaktivieren',
      danger: true,
    };
    await view.confirm(request, () => view.attempt(model.deactivateAction, () => model.deactivate()), 'Mitglied deaktiviert.');
  }
</script>

<AsyncView resource={model.member}>
  {#snippet children(member)}
    <Detail title={editing ? 'Profil bearbeiten' : `${member.firstName} ${member.lastName}`}>
      {#snippet actions()}
        {#if !editing && policy.canEditProfile(member)}<Button onclick={() => (editing = true)}>Profil bearbeiten</Button>{/if}
      {/snippet}
      {#snippet meta()}
        {#if !member.active}<Tag tone="red">Inaktiv</Tag>{/if}
        {#if member.honorary}<Tag tone="yellow">Ehrenmitglied</Tag>{/if}
        {#each member.roles as role (role)}<Tag tone={roleHue(role)}>{ROLE_LABELS[role]}</Tag>{/each}
      {/snippet}

      {#if editing}
        <ProfileEditor {member} {model} ondone={() => (editing = false)} />
      {:else}
        <dl class="props">
          <dt>E-Mail</dt>
          <dd><a href="mailto:{member.email}">{member.email}</a></dd>
          <dt>Telefon</dt>
          <dd>{#if member.phone}<a href="tel:{member.phone}">{member.phone}</a>{:else}–{/if}</dd>
          <dt>Geburtsdatum</dt>
          <dd>{member.birthDate ? session.format.date(member.birthDate) : '–'}</dd>
          <dt>Foto-Einwilligung</dt>
          <dd>{member.photoConsent ? 'Ja' : 'Nein'}</dd>
          <dt>Mitgliedschaft</dt>
          <dd>{membershipKinds.text(member)}</dd>
          {#if member.memberSince}
            <dt>Mitglied seit</dt>
            <dd>{session.format.date(member.memberSince)}</dd>
          {/if}
        </dl>
        {#key member.id}<FamilySection memberId={member.id} firstName={member.firstName} self={policy.isSelf(member)} parent={member.roles.includes('PARENT')} />{/key}
        <HeldItems memberId={member.id} />
      {/if}

      {#if policy.canSetMembership(member) && !editing}
        <h2>Mitgliedschaft</h2>
        {#key member.id + member.membershipType + member.honorary + member.memberSince}<MembershipEditor {member} {model} />{/key}
      {/if}

      {#if policy.canSetRoles(member)}
        <h2>Rollen</h2>
        <div class="stack">
          <RoleChecklist bind:value={roles} allowed={policy.grantableRoles()} legend="Rollen im Verein" />
          <p class="muted small">Die Vorstandsrolle kommt mit einer Funktion auf der Seite <a href="/board">Vorstand</a>.</p>
          {#if policy.isSelf(member)}<p class="muted small">Die eigene Admin-Rolle lässt sich nicht entfernen.</p>{/if}
          <ErrorNote error={model.rolesAction.error} />
          <div><Button variant="primary" busy={model.rolesAction.busy} disabled={!rolesChanged} onclick={() => saveRoles(member)}>Rollen speichern</Button></div>
        </div>
      {/if}

      {#if policy.canLinkGuardian(member)}
        <h2>Erziehungsberechtigte</h2>
        <GuardianLinker {member} {model} />
      {/if}

      {#if policy.canResetSecurity() || policy.canDeactivate(member) || policy.canReactivate(member) || policy.canErase(member)}
        <h2>Zugang</h2>
        <div class="row">
          {#if policy.canResetSecurity() && member.active}
            <Button busy={model.resetAction.busy} onclick={() => resetSecurity(member)}>Sperre aufheben und Geräte entfernen</Button>
          {/if}
          {#if policy.canDeactivate(member)}
            <Button variant="danger" busy={model.deactivateAction.busy} onclick={() => deactivate(member)}>Deaktivieren</Button>
          {/if}
          {#if policy.canReactivate(member)}
            <Button busy={model.reactivateAction.busy} onclick={() => reactivate(member)}>Reaktivieren</Button>
          {/if}
          {#if policy.canErase(member)}
            <Button variant="danger" busy={model.eraseAction.busy} onclick={() => erase(member)}>Personendaten löschen (DSGVO)</Button>
          {/if}
        </div>
      {/if}
    </Detail>
  {/snippet}
</AsyncView>
