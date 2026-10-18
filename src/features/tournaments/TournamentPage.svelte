<script lang="ts">
  import { usePane } from '../../lib/split/usePane';
  import DetailPage from '../../ui/DetailPage.svelte';
  import type { PageProps } from '../Feature';
  import TournamentView from './TournamentView.svelte';

  /** A tournament as a page (from the list, shared links; guests land here). */
  let { params }: PageProps = $props();
  const pane = usePane();
</script>

<DetailPage back={{ href: '/tournaments', label: 'Turniere' }}>
  <TournamentView id={params.id} onclosed={() => pane.navigate('/tournaments')} />
</DetailPage>
