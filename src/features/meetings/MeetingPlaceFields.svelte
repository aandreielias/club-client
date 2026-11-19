<script lang="ts">
  import { settings } from '../../settings';
  import Field from '../../ui/Field.svelte';

  /** Where a meeting is held; kinds with online participation (Einstellungen › Sitzungsarten) also have their call in the app. */
  let { location = $bindable(''), online }: { location: string; online: boolean } = $props();
</script>

<div class="stack">
  <Field label="Ort (optional)" hint={online ? 'Diese Sitzungsart ist online: die Videokonferenz läuft in der App.' : undefined}>
    <input bind:value={location} maxlength={settings.meetings.locationMaxLength} />
  </Field>
</div>
