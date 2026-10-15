<script lang="ts">
  import { toasts } from '../../lib/container';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import { IcalFeedModel } from './IcalFeedModel.svelte';
  import { calendarApi } from './services';

  const feed = new IcalFeedModel(calendarApi);

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toasts.show('Link kopiert.');
    } catch {
      toasts.error('Kopieren nicht möglich. Bitte den Link markieren und kopieren.');
    }
  }
</script>

<section class="stack">
  <p class="muted">
    Mit einem persönlichen Link zeigen Kalender-Apps (Google, Apple, Outlook) deine Termine an. Der Link wird nur einmal
    angezeigt. Ein neuer Link macht den alten ungültig.
  </p>
  {#if feed.url}
    <div class="row">
      <input class="mono url" readonly value={feed.url} aria-label="Kalender-Link" onfocus={(e) => e.currentTarget.select()} />
      <Button onclick={() => copy(feed.url!)}>Kopieren</Button>
    </div>
  {:else if feed.revoked}
    <p>Der Link ist deaktiviert.</p>
  {/if}
  <ErrorNote error={feed.createAction.error ?? feed.revokeAction.error} />
  <div class="row">
    <Button busy={feed.createAction.busy} onclick={() => feed.create()}>Neuen Link erstellen</Button>
    <Button variant="ghost" busy={feed.revokeAction.busy} onclick={() => feed.revoke()}>Link deaktivieren</Button>
  </div>
</section>

<style>
  .url {
    flex: 1;
    min-width: 0;
    width: auto;
  }
</style>
