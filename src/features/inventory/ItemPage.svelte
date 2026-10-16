<script lang="ts">
  import { bus } from '../../lib/container';
  import { NAVIGATE } from '../../channels';
  import DetailPage from '../../ui/DetailPage.svelte';
  import type { PageProps } from '../Feature';
  import ItemView from './ItemView.svelte';

  /** Full-page form of the item window ("Als Seite öffnen", shared links). */
  let { params }: PageProps = $props();
</script>

<DetailPage back={{ href: '/inventory', label: 'Inventar' }}>
  <ItemView id={params.id} onclosed={() => bus.publish(NAVIGATE, { path: '/inventory' })} />
</DetailPage>
