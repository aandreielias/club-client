<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { AppController } from './AppController.svelte';
  import ForgotPasswordPage from './features/auth/ForgotPasswordPage.svelte';
  import LoginPage from './features/auth/LoginPage.svelte';
  import SetPasswordPage from './features/auth/SetPasswordPage.svelte';
  import { features } from './features';
  import OnboardingPage from './features/onboarding/OnboardingPage.svelte';
  import { auth, backStack, bus, commands, documentTitle, pendingDeletes, scrollMemory, directory, errors, keyboard, live, mainPane, pageNavigator, preferences, router, session, split, splitPane, windows } from './lib/container';
  import PaneHost from './ui/PaneHost.svelte';
  import { guestOnly } from './lib/types';
  import SplitDivider from './ui/SplitDivider.svelte';
  import Button from './ui/Button.svelte';
  import Centered from './ui/Centered.svelte';
  import ConfirmDialog from './ui/ConfirmDialog.svelte';
  import WindowHost from './ui/WindowHost.svelte';
  import CommandPalette from './ui/CommandPalette.svelte';
  import SequenceHint from './ui/SequenceHint.svelte';
  import Empty from './ui/Empty.svelte';
  import PinDialog from './ui/PinDialog.svelte';
  import Sidebar from './ui/Sidebar.svelte';
  import ContextMenuHost from './ui/ContextMenuHost.svelte';
  import Toasts from './ui/Toasts.svelte';
  import TooltipHost from './ui/TooltipHost.svelte';

  const app = new AppController({ auth, session, directory, router, features, live, errors, bus, commands, keyboard, windows, preferences, backStack, split, splitPane, pageNavigator });
  const logout = () => app.logout();

  onMount(() => {
    app.start();
  });

  $effect(() => app.syncMember());

  // Each page keeps its scroll position; coming back (Back, sidebar) returns there.
  let shownPath = '';
  $effect(() => {
    const path = router.path;
    if (path === shownPath) return;
    shownPath = path;
    scrollMemory.restore(path);
  });
  const rememberScroll = () => scrollMemory.remember(router.path, window.scrollY);

  /** Typed but unsaved input: the browser asks before the tab closes or reloads. */
  function beforeUnload(event: BeforeUnloadEvent) {
    if (backStack.hasUnsaved()) event.preventDefault();
  }
  $effect(() => {
    document.title = documentTitle.text;
  });

  // Tournament guests have no start page: they land on their tournament list (which opens their tournament).
  $effect(() => {
    if (app.screen === 'shell' && !app.page && guestOnly(session.member.roles)) untrack(() => router.replace('/tournaments'));
  });

  // Only the screen decides; whatever startSession reads must not restart it.
  $effect(() => {
    if (app.screen === 'shell') return untrack(() => app.startSession());
  });
</script>

<svelte:window onscroll={rememberScroll} onbeforeunload={beforeUnload} onpagehide={() => pendingDeletes.flush()} />

{#if app.screen === 'failed'}
  <Centered title="Nicht erreichbar">
    <p>{app.failure}</p>
    <Button onclick={() => location.reload()}>Neu laden</Button>
  </Centered>
{:else if app.screen === 'loading'}
  <Centered title="Laden …" />
{:else if app.screen === 'set-password'}
  <SetPasswordPage />
{:else if app.screen === 'forgot-password'}
  <ForgotPasswordPage />
{:else if app.screen === 'login'}
  <LoginPage />
{:else if app.screen === 'onboarding'}
  <OnboardingPage onlogout={logout} />
{:else if session.me && session.club}
  <div class="shell">
    <Sidebar title={session.club.name} user="{session.member.firstName} {session.member.lastName}" items={app.navigation}
      current={router.path} connection={live.status} onlogout={logout} />
    <main style:view-transition-name="page">
      {#if split.isOpen}
        <div class="panes" style:--split-ratio={split.ratio}>
          <div class="main-pane">
            <PaneHost pane={mainPane}>{@render mainPage()}</PaneHost>
          </div>
          <SplitDivider />
          <div class="split-pane">
            <PaneHost pane={splitPane} label={app.splitPage?.label}>
              {#if app.splitPage}
                {#key splitPane.path}
                  <app.splitPage.component params={app.splitPage.params} />
                {/key}
              {:else}
                <Empty text="Seite nicht gefunden." />
              {/if}
            </PaneHost>
          </div>
        </div>
      {:else}
        <PaneHost pane={mainPane}>{@render mainPage()}</PaneHost>
      {/if}
    </main>
  </div>
{/if}

{#snippet mainPage()}
  {#if app.page}
    {#key router.path}
      <app.page.component params={app.page.params} />
    {/key}
  {:else}
    <Empty text="Seite nicht gefunden." />
  {/if}
{/snippet}

{#if app.screen === 'shell'}
  <WindowHost />
  <CommandPalette />
  <SequenceHint />
{/if}
<PinDialog />
<ConfirmDialog />
<Toasts />
<TooltipHost />
<ContextMenuHost />

<style>
  .shell {
    display: flex;
    min-height: 100dvh;
  }
  main {
    flex: 1;
    min-width: 0;
    transition:
      margin var(--motion-window) var(--motion-easing);
  }
  /* A docked window leaves the page usable next to it. */
  :global(:root[data-window='side']:not([data-layout='compact'])) main {
    margin-right: var(--window-side-width);
  }
  :global(:root[data-window='bottom']:not([data-layout='compact'])) main {
    margin-bottom: var(--window-bottom-height);
  }
  /* Split view: two scrolling panes side by side; on phones only the main page shows. */
  .panes {
    display: flex;
    height: 100dvh;
  }
  .main-pane {
    flex: 0 0 calc(var(--split-ratio) * 100%);
    min-width: 0;
  }
  .split-pane {
    flex: 1;
    min-width: 0;
  }
  :global(:root[data-layout='compact']) .panes :global(.divider),
  :global(:root[data-layout='compact']) .split-pane {
    display: none;
  }
  :global(:root[data-layout='compact']) .main-pane {
    flex-basis: 100%;
  }
</style>
