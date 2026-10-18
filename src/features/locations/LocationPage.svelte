<script lang="ts">
  import { bus } from '../../lib/container';
  import { NAVIGATE } from '../../channels';
  import DetailPage from '../../ui/DetailPage.svelte';
  import type { PageProps } from '../Feature';
  import LocationView from './LocationView.svelte';

  /** Full-page form of the location window ("Als Seite öffnen", shared links). */
  let { params }: PageProps = $props();
</script>

<DetailPage back={{ href: '/locations', label: 'Orte' }}>
  <LocationView id={params.id} onclosed={() => bus.publish(NAVIGATE, { path: '/locations' })} />
</DetailPage>
