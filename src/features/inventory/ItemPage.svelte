<script lang="ts">
  import { router } from '../../lib/container';
  import DetailPage from '../../ui/DetailPage.svelte';
  import type { PageProps } from '../Feature';
  import ItemView from './ItemView.svelte';

  /** Full-page form of the item window ("Als Seite öffnen", shared links). */
  let { params }: PageProps = $props();
</script>

<DetailPage back={{ href: '/inventory', label: 'Inventar' }}>
  <ItemView id={params.id} onclosed={() => router.navigate('/inventory')} />
</DetailPage>
