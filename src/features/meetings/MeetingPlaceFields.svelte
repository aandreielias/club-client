<script lang="ts">
  import Field from '../../ui/Field.svelte';

  /**
   * Where a meeting is held: a place, and for kinds with online participation (Einstellungen › Sitzungsarten) the video link members join by,
   * its own or the kind's standing one.
   */
  let {
    location = $bindable(''),
    videoUrl = $bindable(''),
    online,
    standing = null,
    error = null,
  }: { location: string; videoUrl: string; online: boolean; standing?: string | null; error?: string | null } = $props();
</script>

<div class="stack">
  <Field label="Ort (optional)">
    <input bind:value={location} maxlength="200" />
  </Field>
  {#if online}
    <Field
      label={standing ? 'Eigener Link zur Videokonferenz (optional)' : 'Link zur Videokonferenz'}
      hint={standing ? `Leer lassen für den ständigen Link: ${standing}` : 'Diese Sitzungsart ist online: der Link geht mit der Einladung hinaus.'}
      {error}
    >
      <input type="url" bind:value={videoUrl} maxlength="500" placeholder={standing ?? 'https://'} required={!standing} />
    </Field>
  {/if}
</div>
