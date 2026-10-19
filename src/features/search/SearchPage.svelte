<script lang="ts">
  import { usePane } from '../../lib/split/usePane';
  import { settings } from '../../settings';
  import { bus, router, session, store, windows } from '../../lib/container';
  import { WINDOW_OPEN } from '../../channels';
  import type { MenuEntry } from '../../lib/overlay/ContextMenuService.svelte';
  import { windowMenu } from '../../lib/window/windowMenu';
  import DataTable from '../../ui/DataTable.svelte';
  import Empty from '../../ui/Empty.svelte';
  import Page from '../../ui/Page.svelte';
  import Tag from '../../ui/Tag.svelte';
  import { hitDetail, hitTarget, kindLabel, type SearchHit } from './model';
  import { SearchListModel } from './SearchListModel.svelte';
  import { searchApi } from './services';

  /** Results of the sidebar search (`/search?q=`); a result opens in the window, a folder on the files page. */
  const pane = usePane();
  const query = $derived(pane.query.get('q')?.trim() ?? '');
  const list = new SearchListModel(searchApi, () => query, () => session.format, store);

  $effect(() => {
    void query;
    void list.load();
  });

  function open(hit: SearchHit) {
    const target = hitTarget(hit);
    if ('window' in target) bus.publish(WINDOW_OPEN, { kind: target.window.kind, id: target.window.id });
    else pane.navigate(target.path);
  }

  function hitMenu(hit: SearchHit): MenuEntry[] {
    const target = hitTarget(hit);
    return 'window' in target ? windowMenu(bus, windows, router, target.window.kind, target.window.id) : [{ label: 'Öffnen', run: () => open(hit) }];
  }
</script>

<Page title={query ? `Suche: ${query}` : 'Suche'}>
  {#if SearchListModel.searchable(query)}
    <DataTable
      model={list}
      rowKey={(h) => `${h.kind}:${h.id}`}
      record={(h) => { const target = hitTarget(h); return 'window' in target ? { ...target.window, title: h.title } : null; }}
      onopen={open}
      menu={hitMenu}
      selected={windows.current ? `${windows.current.kind.toUpperCase()}:${windows.current.id}` : null}
      emptyText="Nichts gefunden. Anderen Suchbegriff versuchen."
    >
      {#snippet cell(hit, column)}
        {#if column.key === 'kind'}
          <Tag tone="gray">{kindLabel(hit.kind)}</Tag>
        {:else if column.key === 'detail'}
          {hitDetail(hit)}
        {:else}
          {list.display(hit, column)}
        {/if}
      {/snippet}
    </DataTable>
  {:else}
    <Empty text="Suchbegriff mit mindestens {settings.search.minQueryLength} Zeichen ins Suchfeld der Seitenleiste eingeben." />
  {/if}
</Page>
