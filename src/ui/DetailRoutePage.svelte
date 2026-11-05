<script lang="ts" module>
  import type { Component } from 'svelte';

  type Back = { href: string; label: string };

  /** A record's window shown as a full page; the view gets the route's `:id` (or `:key`). */
  export interface DetailRoute {
    view: Component<{ id: string; onclosed?: () => void }>;
    back: Back | (() => Back);
  }
</script>

<script lang="ts">
  import { usePane } from '../lib/split/usePane';
  import type { RouteParams } from '../lib/router/Router.svelte';
  import DetailPage from './DetailPage.svelte';

  /** A record's window as a full page ("Als Seite öffnen", shared links); closing it goes back. */
  let { params, detail }: { params: RouteParams; detail: DetailRoute } = $props();
  const pane = usePane();
  const back = $derived(typeof detail.back === 'function' ? detail.back() : detail.back);
</script>

<DetailPage {back}>
  <detail.view id={params.id ?? params.key} onclosed={() => pane.navigate(back.href)} />
</DetailPage>
