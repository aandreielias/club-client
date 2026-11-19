<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Action } from '../../lib/state/Action.svelte';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import { CallSession } from './CallSession.svelte';
  import { meetingsApi } from './services';

  /** The video call of an online meeting, in the app: join, the others' video, own microphone and camera, leave. */
  let { meetingId }: { meetingId: string } = $props();

  const action = new Action();
  // svelte-ignore state_referenced_locally
  const call = new CallSession(meetingsApi, meetingId, (error) => (action.error = error));

  function media(video: HTMLVideoElement, stream: MediaStream) {
    video.srcObject = stream;
    return { update: (next: MediaStream) => (video.srcObject = next) };
  }

  async function join() {
    if (!(await action.run(() => call.join()))) await call.leave();
  }

  onDestroy(() => void call.leave());
</script>

<svelte:window onpagehide={() => void call.leave(false)} />

<div class="stack">
  {#if call.joined}
    <div class="grid">
      {#if call.local}
        <figure>
          <video use:media={call.local} autoplay playsinline muted></video>
          <figcaption>Du{call.micOn ? '' : ' (stumm)'}</figcaption>
        </figure>
      {/if}
      {#each call.peers as peer (peer.memberId)}
        <figure>
          <video use:media={peer.stream} autoplay playsinline></video>
          <figcaption>{peer.name}</figcaption>
        </figure>
      {/each}
    </div>
    <div class="row">
      {#if call.local?.getAudioTracks().length}
        <Button
          size="sm"
          icon={call.micOn ? 'mic' : 'micOff'}
          pressed={!call.micOn}
          tooltip={call.micOn ? 'Mikrofon aus' : 'Mikrofon an'}
          onclick={() => call.toggleMic()}
        />
      {/if}
      {#if call.local?.getVideoTracks().length}
        <Button
          size="sm"
          icon={call.cameraOn ? 'camera' : 'cameraOff'}
          pressed={!call.cameraOn}
          tooltip={call.cameraOn ? 'Kamera aus' : 'Kamera an'}
          onclick={() => call.toggleCamera()}
        />
      {/if}
      <Button size="sm" variant="danger" icon="hangUp" onclick={() => void call.leave()}>Verlassen</Button>
    </div>
  {:else}
    <div>
      <Button size="sm" icon="camera" busy={action.busy} tooltip="Mit Kamera und Mikrofon an der Videokonferenz teilnehmen" onclick={join}
        >Beitreten</Button
      >
    </div>
  {/if}
  <ErrorNote error={action.error} />
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
    gap: var(--space-sm);
  }
  figure {
    position: relative;
    margin: 0;
  }
  video {
    width: 100%;
    aspect-ratio: 4 / 3;
    object-fit: cover;
    border-radius: var(--radius-md);
    background: var(--color-text);
  }
  figcaption {
    position: absolute;
    left: var(--space-sm);
    bottom: var(--space-sm);
    padding: 0 var(--space-xs);
    border-radius: var(--radius-sm);
    background: var(--color-elevated);
    color: var(--color-text);
    font-size: var(--font-size-small);
  }
</style>
