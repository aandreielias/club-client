<script lang="ts">
  import { bus } from '../../lib/container';
  import { NAVIGATE, WINDOW_OPEN } from '../../channels';
  import { Resource } from '../../lib/state/Resource.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Empty from '../../ui/Empty.svelte';
  import Page from '../../ui/Page.svelte';
  import type { PageProps } from '../Feature';
  import { mailApi } from './services';

  /** `/r/<code>`: a record linked in a mail, opened from outside the app; opens it in the window when the member may see it. */
  let { params }: PageProps = $props();

  // svelte-ignore state_referenced_locally
  const ref = new Resource(async () => (await mailApi.resolveRefs([params.code]))[0] ?? null);
  void ref.load().then(() => {
    const found = ref.value;
    if (!found?.visible) return;
    bus.publish(NAVIGATE, { path: '/', replace: true });
    bus.publish(WINDOW_OPEN, { kind: found.kind!.toLowerCase(), id: found.windowId! });
  });
</script>

<Page title="Verweis">
  <AsyncView resource={ref}>
    {#snippet children(found)}
      {#if !found?.visible}<Empty text="Diesen Verweis gibt es nicht, oder der Eintrag ist für dich nicht sichtbar." />{/if}
    {/snippet}
  </AsyncView>
</Page>
