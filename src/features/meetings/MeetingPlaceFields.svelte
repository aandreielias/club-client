<script lang="ts">
  import Field from '../../ui/Field.svelte';

  /** Where a meeting is held: a place, and whether members may join online through a video link the organiser enters. */
  let {
    location = $bindable(''),
    online = $bindable(false),
    videoUrl = $bindable(''),
    error = null,
  }: { location: string; online: boolean; videoUrl: string; error?: string | null } = $props();
</script>

<div class="stack">
  <Field label="Ort (optional)">
    <input bind:value={location} maxlength="200" />
  </Field>
  <label class="check"><input type="checkbox" bind:checked={online} /> Online-Teilnahme möglich</label>
  {#if online}
    <Field label="Link zur Videokonferenz" hint="Zoom, Teams, Jitsi … der Link geht mit der Einladung hinaus." {error}>
      <input type="url" bind:value={videoUrl} maxlength="500" placeholder="https://" required />
    </Field>
  {/if}
</div>
