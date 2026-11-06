<script lang="ts">
  // Placeholder of a record view while its record loads: title and a few lines, so the window does not stay blank.
</script>

<div class="detail-skeleton" aria-busy="true" aria-label="Laden">
  <span class="skeleton title"></span>
  <span class="skeleton"></span><span class="skeleton"></span><span class="skeleton short"></span>
</div>

<style>
  .detail-skeleton {
    display: grid;
    gap: var(--space-sm);
  }
  span {
    height: 14px;
  }
  .title {
    width: 40%;
    height: 28px;
    margin-bottom: var(--space-md);
  }
  .short {
    width: 60%;
  }
</style>
