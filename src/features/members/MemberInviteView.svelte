<script lang="ts">
  import { autofocus } from '../../ui/autofocus';
  import { settings } from '../../settings';
  import { bus, directory, session } from '../../lib/container';
  import { Resource } from '../../lib/state/Resource.svelte';
  import { CreateController } from '../../lib/detail/CreateController.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import Button from '../../ui/Button.svelte';
  import Detail from '../../ui/Detail.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import DateInput from '../../ui/DateInput.svelte';
  import { InviteForm } from './MemberForms.svelte';
  import RoleChecklist from './RoleChecklist.svelte';
  import Select from '../../ui/Select.svelte';
  import { memberPolicy as policy, membersApi, membershipKinds } from './services';

  /** Invitation of a new member in the window; afterwards the window shows the new member. */
  let { handle }: { id: string; handle: WindowHandle } = $props();

  const today = session.clock.today();
  const form = new InviteForm(today);
  // svelte-ignore state_referenced_locally
  const create = new CreateController(bus, handle, 'Neues Konto anlegen');
  const max = settings.members.nameMaxLength;
  const guardians = new Resource(() => directory.allMembers());
  void guardians.load();
  const guardianOptions = $derived(
    (guardians.value ?? []).filter((m) => m.active).map((m) => ({ value: m.id, label: `${m.lastName}, ${m.firstName}` })),
  );

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    form.submitted = true;
    if (!form.valid) return;
    await create.submit(async () => (await membersApi.invite(form.toInvitation())).id, 'member', 'Konto angelegt, Einladung verschickt.');
  }
</script>

<Detail title="Neues Konto anlegen">
  <p class="muted">Daten aus dem Aufnahmeantrag eintragen. Die Person bekommt an ihre private E-Mail einen Link und legt ihr Passwort fest.</p>
  <form class="stack" onsubmit={submit} novalidate {@attach autofocus}>
    <div class="grid-3">
      <Field label="Vorname" error={form.error('firstName')}>
        <input bind:value={form.firstName} maxlength={max} required />
      </Field>
      <Field label="Zweiter Vorname (optional)" error={form.error('middleName')}>
        <input bind:value={form.middleName} maxlength={max} />
      </Field>
      <Field label="Nachname" error={form.error('lastName')}>
        <input bind:value={form.lastName} maxlength={max} required />
      </Field>
    </div>
    <div class="grid-2">
      <Field label="Private E-Mail" hint="Für die Anmeldung und die Einladung." error={form.error('email')}>
        <input type="email" bind:value={form.email} autocomplete="off" required />
      </Field>
      <Field label="Geburtsdatum" error={form.error('birthDate')}>
        <DateInput bind:value={form.birthDate} max={today} min={settings.members.earliestBirthDate} required />
      </Field>
    </div>
    <Field
      label="Mitgliedschaft"
      hint="Mitglied ab heute. Nur mit Stimmrecht gehört jemand zur Mitgliederversammlung, nur wählbar in eine Funktion. Ehrenmitglied wird man durch Beschluss."
      error={form.error('membershipType')}
    >
      <Select bind:value={form.membershipType} placeholder="Bitte wählen" options={membershipKinds.inviteChoices()} aria-label="Mitgliedschaft" />
    </Field>
    <details class="more">
      <summary>Weitere Angaben (optional)</summary>
      <div class="stack">
        <Field label="Telefon" error={form.error('phone')}>
          <input type="tel" bind:value={form.phone} maxlength={settings.profile.phoneMaxLength} autocomplete="off" />
        </Field>
        <Field label="Erziehungsberechtigte:r" hint="Für Minderjährige: sieht danach Termine, Aufgaben und das Geburtsdatum.">
          <Select bind:value={form.guardianId} placeholder="Keine" options={guardianOptions} />
          {#if !guardianOptions.length}<p class="muted small">Eltern zuerst anlegen (als „Kein Mitglied“), dann das Kind.</p>{/if}
        </Field>
        <label class="check"><input type="checkbox" bind:checked={form.photoConsent} /> Einverständnis für Fotos liegt vor</label>
      </div>
    </details>
    <RoleChecklist bind:value={form.roles} allowed={policy.grantableRoles()} legend="Rollen" />
    <ErrorNote error={create.save.error} />
    <div class="row">
      <Button type="submit" variant="primary" busy={create.save.busy}>Konto anlegen</Button>
      <Button variant="ghost" onclick={() => handle.close()}>Abbrechen</Button>
    </div>
  </form>
</Detail>

<style>
  .grid-3 {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    gap: var(--space-md);
  }
  .more summary {
    cursor: pointer;
    margin-bottom: var(--space-sm);
  }
</style>
