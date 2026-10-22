<script lang="ts">
  import { usePane } from '../../lib/split/usePane';
  import DetailPage from '../../ui/DetailPage.svelte';
  import type { PageProps } from '../Feature';
  import ResolutionView from './ResolutionView.svelte';

  /** A resolution as a page (link of the circular vote's notification). */
  let { params }: PageProps = $props();
  const pane = usePane();
</script>

<DetailPage back={{ href: '/meetings', label: 'Sitzungen' }}>
  <ResolutionView id={params.id} onclosed={() => pane.navigate('/meetings')} />
</DetailPage>
