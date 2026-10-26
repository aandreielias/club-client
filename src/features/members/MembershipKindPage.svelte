<script lang="ts">
  import { usePane } from '../../lib/split/usePane';
  import DetailPage from '../../ui/DetailPage.svelte';
  import type { PageProps } from '../Feature';
  import MembershipKindView from './MembershipKindView.svelte';

  /** Full page of the membership kind window ("Als Seite öffnen", shared links). */
  let { params }: PageProps = $props();
  const pane = usePane();
</script>

<DetailPage back={{ href: '/settings/membership', label: 'Mitgliedschaft' }}>
  <MembershipKindView id={params.key} onclosed={() => pane.navigate('/settings/membership')} />
</DetailPage>
