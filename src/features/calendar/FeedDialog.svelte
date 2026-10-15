<script lang="ts">
  import Dialog from '../../ui/Dialog.svelte';
  import FeedPanel from './FeedPanel.svelte';

  let { onclose }: { onclose: () => void } = $props();
</script>

<Dialog open title="Kalender abonnieren" {onclose}>
  <FeedPanel />
</Dialog>
