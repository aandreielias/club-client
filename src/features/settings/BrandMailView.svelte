<script lang="ts">
  import { TOAST } from '../../channels';
  import { bus, session } from '../../lib/container';
  import { Action } from '../../lib/state/Action.svelte';
  import { SettingsDraft } from '../../lib/state/SettingsDraft.svelte';
  import { settings } from '../../settings';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import SettingsForm from '../../ui/SettingsForm.svelte';
  import { brandOf, formOf, validBrand, type BrandForm } from './brandForm';

  /**
   * Erscheinungsbild › E-Mails: the notification e-mails, laid out like writing a mail. Betreff and Text are a sample to try
   * (not stored); Anrede, Grußformel and Fußzeile are saved with the brand. The mail below follows every keystroke.
   */
  const draft = new SettingsDraft<BrandForm>(formOf(session.club!.brand));
  const valid = $derived(validBrand(draft.value, session.club!.brand));

  // The server's own sample (texts.properties email.sample.*), editable here.
  let subject = $state('Neue Aufgabe: Kuchen für das Turnier');
  let text = $state('So sehen E-Mails des Vereins aus. Fällig: Samstag, 18:00.');
  const sample = () => ({ brand: $state.snapshot(valid), subject: subject.trim() || null, text: text.trim() || null });

  async function save(value: BrandForm): Promise<BrandForm> {
    await session.updateBrand(brandOf(value));
    return formOf(session.club!.brand);
  }

  // The mail follows the draft a moment after typing stops; a refused draft keeps the last preview.
  let mail = $state('');
  const preview = new Action();
  $effect(() => {
    const current = sample();
    const timer = setTimeout(() => {
      void preview.run(async () => (mail = (await session.mailPreview(current)).html));
    }, settings.brand.mailPreviewDebounceMs);
    return () => clearTimeout(timer);
  });

  const testMail = new Action();
  async function sendTestMail() {
    if (await testMail.run(() => session.sendTestMail(sample()))) bus.publish(TOAST, { text: 'Testmail an deine Adresse gesendet.' });
  }
</script>

<SettingsForm
  title="E-Mails"
  intro="Benachrichtigungen der App per E-Mail tragen das E-Mail-Logo, die Hauptfarbe und diese Texte. Einladungs- und Passwort-Mails des Anmeldedienstes und Mails aus den Postfächern bleiben unverändert."
  {draft}
  onsave={save}
  hint="Gilt für alle Benachrichtigungen"
>
  <Field label="Von">
    <input value={session.club!.name} readonly />
  </Field>
  <Field label="An">
    <input value={session.member.email ?? ''} readonly />
  </Field>
  <Field label="Betreff" hint="Beispiel zum Ausprobieren, wird nicht gespeichert">
    <input bind:value={subject} maxlength="200" />
  </Field>
  <Field label="Anrede" hint="{'{vorname}'} wird zum Vornamen; leer = „Hallo Vorname,“">
    <input bind:value={draft.value.mailGreeting} maxlength="100" placeholder="Hallo {'{vorname}'}," />
  </Field>
  <Field label="Text" hint="Beispiel zum Ausprobieren, wird nicht gespeichert; Benachrichtigungen sind reiner Text">
    <textarea bind:value={text} maxlength="2000" rows="5"></textarea>
  </Field>
  <Field label="Grußformel" hint="Darunter steht der Vereinsname; leer = „Viele Grüße“">
    <input bind:value={draft.value.mailSignOff} maxlength="200" placeholder="Viele Grüße" />
  </Field>
  <Field label="Fußzeile" hint="Z. B. Adresse oder Registernummer; bis 500 Zeichen">
    <textarea bind:value={draft.value.mailFooter} maxlength="500" rows="3"></textarea>
  </Field>

  <h3>So kommt sie an</h3>
  <iframe class="mail" title="Vorschau der E-Mail" sandbox="" srcdoc={mail}></iframe>
  <div class="row">
    <Button busy={testMail.busy} tooltip="Diese Beispiel-E-Mail an deine eigene Adresse senden" onclick={sendTestMail}>Testmail senden</Button>
    <ErrorNote error={testMail.error ?? preview.error} />
  </div>
</SettingsForm>

<style>
  .mail {
    width: 100%;
    height: 420px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: #fff;
  }
</style>
