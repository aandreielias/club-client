<script lang="ts">
  import { usePane } from '../../lib/split/usePane';
  import DetailPage from '../../ui/DetailPage.svelte';
  import type { PageProps } from '../Feature';
  import ItemView from './ItemView.svelte';

  /** Full-page form of the item window ("Als Seite öffnen", shared links). */
  let { params }: PageProps = $props();
  const pane = usePane();
</script>

<DetailPage back={{ href: '/inventory', label: 'Inventar' }}>
  <ItemView id={params.id} onclosed={() => pane.navigate('/inventory')} />
</DetailPage>
