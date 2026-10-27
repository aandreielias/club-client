<script lang="ts">
  import { autofocus } from '../../ui/autofocus';
  import { settings } from '../../settings';
  import { bus, session } from '../../lib/container';
  import { TOAST } from '../../channels';
  import type { Member } from '../../lib/types';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import DateInput from '../../ui/DateInput.svelte';
  import type { MemberDetailModel } from './MemberDetailModel.svelte';
  import { ProfileForm } from './MemberForms.svelte';
  import { memberPolicy as policy } from './services';

  let { member, model, ondone }: { member: Member; model: MemberDetailModel; ondone: () => void } = $props();

  const today = session.clock.today();
  // svelte-ignore state_referenced_locally
  const form = new ProfileForm(member, today);
  const max = settings.members.nameMaxLength;
  // Guardians change phone, photo consent and a missing birth date; names only admin/board (server: member.change-needs-request).
  const names = policy.canEditNames();

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    form.submitted = true;
    if (!form.valid) return;
    const patch = form.toPatch();
    const email = form.changedEmail();
    if ((!Object.keys(patch).length && !email) || (await model.saveProfile(patch, email))) {
      bus.publish(TOAST, { text: 'Profil gespeichert.' });
      ondone();
    }
  }
</script>

<form class="stack" onsubmit={submit} novalidate {@attach autofocus}>
  <div class="grid">
    {#if policy.canChangeEmail(member)}
      <Field label="E-Mail" hint="Ändert auch die Anmeldung." error={form.error('email')}>
        <input type="email" bind:value={form.email} autocomplete="off" required />
      </Field>
    {/if}
    {#if names}
      <Field label="Vorname" error={form.error('firstName')}>
        <input bind:value={form.firstName} maxlength={max} required />
      </Field>
      <Field label="Nachname" error={form.error('lastName')}>
        <input bind:value={form.lastName} maxlength={max} required />
      </Field>
    {/if}
    {#if names || !member.birthDate}
      <Field
        label="Geburtsdatum"
        hint={member.birthDate ? undefined : names ? 'Noch nicht eingetragen.' : 'Noch nicht eingetragen; danach nur über den Verein änderbar.'}
        error={form.error('birthDate')}
      >
        <DateInput bind:value={form.birthDate} max={today} min={settings.members.earliestBirthDate} />
      </Field>
    {/if}
    <Field label="Telefon" error={form.error('phone')}>
      <input type="tel" bind:value={form.phone} maxlength={settings.profile.phoneMaxLength} />
    </Field>
  </div>
  <label class="check">
    <input type="checkbox" bind:checked={form.photoConsent} />
    Foto-Einwilligung liegt vor
  </label>
  {#if !names}<p class="muted small">Namen und Geburtsdatum ändert {member.firstName} über „Mein Konto“ → „Änderung anfragen“.</p>{/if}
  <ErrorNote error={model.profileAction.error} />
  <div class="row">
    <Button type="submit" variant="primary" busy={model.profileAction.busy}>Speichern</Button>
    <Button variant="ghost" onclick={ondone}>Abbrechen</Button>
  </div>
</form>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: var(--space-md);
  }
</style>
