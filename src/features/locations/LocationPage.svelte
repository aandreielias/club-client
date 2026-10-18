<script lang="ts">
  import { usePane } from '../../lib/split/usePane';
  import DetailPage from '../../ui/DetailPage.svelte';
  import type { PageProps } from '../Feature';
  import LocationView from './LocationView.svelte';

  /** Full-page form of the location window ("Als Seite öffnen", shared links). */
  let { params }: PageProps = $props();
  const pane = usePane();
</script>

<DetailPage back={{ href: '/locations', label: 'Orte' }}>
  <LocationView id={params.id} onclosed={() => pane.navigate('/locations')} />
</DetailPage>
