<script lang="ts">
  import { usePane } from '../../lib/split/usePane';
  import DetailPage from '../../ui/DetailPage.svelte';
  import type { PageProps } from '../Feature';
  import MailboxView from './MailboxView.svelte';

  /** Full page of the mailbox window ("Als Seite öffnen", shared links). */
  let { params }: PageProps = $props();
  const pane = usePane();
</script>

<DetailPage back={{ href: '/settings/mailboxes', label: 'Postfächer' }}>
  <MailboxView id={params.id} onclosed={() => pane.navigate('/settings/mailboxes')} />
</DetailPage>
