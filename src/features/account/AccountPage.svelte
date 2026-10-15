<script lang="ts">
  import { settings } from '../../settings';
  import { session, toasts, windows } from '../../lib/container';
  import { Action } from '../../lib/state/Action.svelte';
  import { ROLE_LABELS } from '../../lib/types';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import Page from '../../ui/Page.svelte';
  import Tag from '../../ui/Tag.svelte';

  const savePhone = new Action();

  const member = $derived(session.member);
  let phone = $state(session.member.phone ?? '');

  async function submitPhone(event: SubmitEvent) {
    event.preventDefault();
    if (await savePhone.run(() => session.updateProfile({ phone: phone.trim() || null }))) toasts.show('Telefonnummer gespeichert.');
  }
</script>

<Page title="Mein Konto">
  {#snippet actions()}
    <Button onclick={() => windows.open('settings', 'security')}>PIN und Passwort</Button>
    <Button onclick={() => windows.open('settings', 'appearance')}>Einstellungen</Button>
  {/snippet}

  <dl class="props">
    <dt>Name</dt>
    <dd>{member.firstName} {member.lastName}</dd>
    <dt>E-Mail</dt>
    <dd>{member.email}</dd>
    <dt>Geburtsdatum</dt>
    <dd>{member.birthDate ? session.format.date(member.birthDate) : '–'}</dd>
    <dt>Rollen</dt>
    <dd>{#each member.roles as role (role)}<Tag tone="gray">{ROLE_LABELS[role]}</Tag>{/each}</dd>
    <dt>Teams</dt>
    <dd>{#each session.teams as team (team.id)}<Tag tone="blue">{team.name}</Tag>{:else}–{/each}</dd>
  </dl>

  <h2>Telefon</h2>
  <form class="stack narrow" onsubmit={submitPhone}>
    <Field label="Telefonnummer">
      <input type="tel" bind:value={phone} maxlength={settings.profile.phoneMaxLength} autocomplete="tel" />
    </Field>
    <ErrorNote error={savePhone.error} />
    <div><Button type="submit" busy={savePhone.busy}>Speichern</Button></div>
  </form>
</Page>
