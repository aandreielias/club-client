<script lang="ts">
  import { bus, commands, session } from '../../lib/container';
  import { APP_ERROR, CONFIRM, TOAST } from '../../channels';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import { ROLE_LABELS, type Member, type Role } from '../../lib/types';
  import { roleHue } from './roles';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Detail from '../../ui/Detail.svelte';
  import Tag from '../../ui/Tag.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import GuardianLinker from './GuardianLinker.svelte';
  import { MemberDetailModel } from './MemberDetailModel.svelte';
  import ProfileEditor from './ProfileEditor.svelte';
  import RoleChecklist from './RoleChecklist.svelte';
  import { memberPolicy as policy, membersApi } from './services';

  /** One member: profile, roles, guardians, access. Window and page. */
  let { id, handle }: { id: string; handle?: WindowHandle } = $props();

  // svelte-ignore state_referenced_locally
  const model = new MemberDetailModel(membersApi, id);
  void model.load();

  $effect(() => {
    const member = model.member.value;
    if (member) handle?.setTitle(`${member.firstName} ${member.lastName}`);
  });

  let editing = $state(false);
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
      bus.publish(TOAST, { text: 'Rollen gespeichert.' });
      if (policy.isSelf(member)) await session.loadMe();
    }
  }

  async function resetPin(member: Member) {
    const ok = await bus.request(CONFIRM, {
      title: 'PIN zurücksetzen',
      message: `${member.firstName} ${member.lastName} muss danach eine neue PIN festlegen. Face-ID-Geräte werden entfernt.`,
      confirmLabel: 'Zurücksetzen',
      danger: true,
    });
    if (!ok) return;
    if (!(await model.resetPin())) {
      bus.publish(APP_ERROR, model.resetAction.error);
      return;
    }
    bus.publish(TOAST, { text: 'PIN zurückgesetzt.' });
    if (policy.isSelf(member)) await session.loadMe(); // own PIN gone: onboarding asks for a new one
  }

  async function deactivate(member: Member) {
    const ok = await bus.request(CONFIRM, {
      title: 'Mitglied deaktivieren',
      message: `${member.firstName} ${member.lastName} kann sich danach nicht mehr anmelden und wird aus allen Teams entfernt.`,
      confirmLabel: 'Deaktivieren',
      danger: true,
    });
    if (!ok) return;
    if (await model.deactivate()) bus.publish(TOAST, { text: 'Mitglied deaktiviert.' });
    else bus.publish(APP_ERROR, model.deactivateAction.error);
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
        </dl>
      {/if}

      {#if policy.canSetRoles(member)}
        <h2>Rollen</h2>
        <div class="stack">
          <RoleChecklist bind:value={roles} allowed={policy.grantableRoles()} legend="Rollen im Verein" />
          {#if policy.isSelf(member)}<p class="muted small">Die eigene Admin-Rolle lässt sich nicht entfernen.</p>{/if}
          <ErrorNote error={model.rolesAction.error} />
          <div><Button variant="primary" busy={model.rolesAction.busy} disabled={!rolesChanged} onclick={() => saveRoles(member)}>Rollen speichern</Button></div>
        </div>
      {/if}

      {#if policy.canLinkGuardian(member)}
        <h2>Erziehungsberechtigte</h2>
        <GuardianLinker {member} {model} />
      {/if}

      {#if policy.canResetPin() || policy.canDeactivate(member)}
        <h2>Zugang</h2>
        <div class="row">
          {#if policy.canResetPin() && member.active}
            <Button busy={model.resetAction.busy} onclick={() => resetPin(member)}>PIN zurücksetzen</Button>
          {/if}
          {#if policy.canDeactivate(member)}
            <Button variant="danger" busy={model.deactivateAction.busy} onclick={() => deactivate(member)}>Deaktivieren</Button>
          {/if}
        </div>
      {/if}
    </Detail>
  {/snippet}
</AsyncView>
