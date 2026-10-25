<script lang="ts">
  import { settings } from '../../settings';
  import { session } from '../../lib/container';
  import { Action } from '../../lib/state/Action.svelte';
  import Button from '../../ui/Button.svelte';
  import Dialog from '../../ui/Dialog.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import DateInput from '../../ui/DateInput.svelte';
  import type { StoredFile } from './model';
  import { filesApi } from './services';
  import { nextVersion } from './VersionLabel';

  /** Uploads a new version of a document: the file (same type), a version number and the date it stands for. */
  let { file, onclose, onsaved }: { file: StoredFile; onclose: () => void; onsaved: (saved: StoredFile) => void } = $props();

  // svelte-ignore state_referenced_locally
  const extension = file.name.includes('.') ? `.${file.name.split('.').pop()}` : undefined;
  // svelte-ignore state_referenced_locally
  let label = $state(nextVersion(file.version ?? '1.0'));
  let date = $state(session.clock.today());
  let chosen = $state<File | null>(null);
  let submitted = $state(false);
  const action = new Action();

  const labelError = $derived(!label.trim() || label.trim().length > settings.files.versionLabelMaxLength
    ? `Versionsnummer mit 1 bis ${settings.files.versionLabelMaxLength} Zeichen.` : null);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    submitted = true;
    if (!chosen || labelError || !date) return;
    const saved = await action.attempt(() => filesApi.uploadVersion(file.id, chosen!, label.trim(), date));
    if (saved) onsaved(saved);
  }
</script>

<Dialog open title="Neue Version von „{file.name}“" {onclose}>
  <form class="stack" onsubmit={submit} novalidate>
    <Field label="Datei" hint="Gleicher Dateityp wie bisher{extension ? ` (${extension})` : ''}." error={submitted && !chosen ? 'Datei auswählen.' : null}>
      <input type="file" accept={extension} onchange={(e) => (chosen = e.currentTarget.files?.[0] ?? null)} />
    </Field>
    <div class="grid-2">
      <Field label="Version" hint={file.version ? `Bisher ${file.version}` : 'Bisher 1.0'} error={submitted ? labelError : null}>
        <input bind:value={label} maxlength={settings.files.versionLabelMaxLength} required />
      </Field>
      <Field label="Stand vom" error={submitted && !date ? 'Datum angeben.' : null}>
        <DateInput bind:value={date} required />
      </Field>
    </div>
    <ErrorNote error={action.error} />
    <div class="row">
      <Button type="submit" variant="primary" icon="upload" busy={action.busy}>Version hochladen</Button>
      <Button variant="ghost" onclick={onclose}>Abbrechen</Button>
    </div>
  </form>
</Dialog>
