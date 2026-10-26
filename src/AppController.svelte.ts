import type { Component } from 'svelte';
import type { FeatureRoute, PageProps } from './features/Feature';
import type { FeatureRegistry, NavItem } from './features/FeatureRegistry';
import type { AuthService } from './lib/auth/AuthService.svelte';
import type { TeamDirectory } from './lib/directory/TeamDirectory.svelte';
import type { ErrorMessages } from './lib/errors/ErrorMessages';
import type { CommandRegistry } from './lib/keyboard/CommandRegistry.svelte';
import type { KeyboardService } from './lib/keyboard/KeyboardService.svelte';
import type { LiveUpdates } from './lib/live/LiveUpdates.svelte';
import type { PreferencesService } from './lib/preferences/PreferencesService.svelte';
import type { WindowService } from './lib/window/WindowService.svelte';
import { SHORTCUTS, type CommandId } from './shortcuts';
import type { EventBus } from './lib/bus';
import type { BackStack } from './lib/navigation/BackStack.svelte';
import { APP_ERROR, NAVIGATE, WINDOW_CLOSE, WINDOW_OPEN } from './channels';
import { MEMBERSHIP_CHANGED } from './features/teams/events';
import { CLUB_CHANGED } from './lib/session/events';
import { Router, type RouteParams } from './lib/router/Router.svelte';
import type { Pane } from './lib/split/Pane';
import type { PageNavigator } from './lib/navigation/PageNavigator';
import type { SplitView } from './lib/split/SplitView.svelte';
import type { SessionStore } from './lib/session/SessionStore.svelte';
import type { PendingDeletes } from './lib/state/PendingDeletes.svelte';
import { ProblemError } from './lib/http/ProblemError';
import { guestOnly } from './lib/types';

/** Which top-level screen the app shows; derived from auth, profile and route state. */
export type Screen = 'failed' | 'loading' | 'set-password' | 'forgot-password' | 'login' | 'onboarding' | 'setup' | 'shell';

const AUTH_PATHS = { setPassword: '/set-password', forgotPassword: '/forgot-password' } as const;

export interface AppDependencies {
  auth: AuthService;
  session: SessionStore;
  directory: TeamDirectory;
  router: Router;
  features: FeatureRegistry;
  live: LiveUpdates;
  errors: ErrorMessages;
  bus: EventBus;
  commands: CommandRegistry;
  keyboard: KeyboardService;
  windows: WindowService;
  preferences: PreferencesService;
  backStack: BackStack;
  split: SplitView;
  splitPane: Pane;
  pageNavigator: PageNavigator;
  pendingDeletes: PendingDeletes;
  /** Removes what the last member left in this browser (recent records, list filters …); keeps device settings. */
  forgetUser: () => void;
}

/** A resolved page: what to render and with which route parameters. */
export interface ResolvedPage {
  component: Component<PageProps>;
  params: RouteParams;
  /** Sidebar label of the route, if it has one (the split pane's header). */
  label: string | null;
}

/** Drives start-up, login/logout transitions, the signed-in session and page resolution for App.svelte. */
export class AppController {
  failure = $state<string | null>(null);

  readonly screen: Screen;
  readonly allowedRoutes: FeatureRoute[];
  readonly navigation: NavItem[];
  readonly page: ResolvedPage | null;
  /** The page of the split view's second pane; null when the split is closed or the path is unknown. */
  readonly splitPage: ResolvedPage | null;

  #loadingMe = false;

  constructor(private readonly deps: AppDependencies) {
    const { features, session, router } = deps;
    this.screen = $derived.by(() => this.computeScreen());
    this.allowedRoutes = $derived(features.allowed((...roles) => session.hasRole(...roles), guestOnly(session.me?.member.roles ?? [])));
    this.navigation = $derived(features.navigation(this.allowedRoutes, deps.preferences.values.navOrder));
    this.page = $derived.by(() => this.resolve(router.path));
    this.splitPage = $derived.by(() => (deps.split.isOpen ? this.resolve(deps.splitPane.path) : null));
  }

  async start(): Promise<void> {
    const { auth, router, session, errors, bus } = this.deps;
    try {
      const needsPassword = await auth.init();
      router.start();
      if (needsPassword) bus.publish(NAVIGATE, { path: AUTH_PATHS.setPassword, replace: true });
      await session.loadClub();
    } catch (error) {
      this.failure = errors.text(error);
    }
  }

  /**
   * Keeps the member in step with the login: loads it after sign-in, drops cached member data after
   * sign-out (also when the sign-out did not come from `logout`). Call from an effect.
   */
  syncMember(): void {
    const { auth, session, directory, bus } = this.deps;
    if (!auth.signedIn) {
      if (session.me) {
        session.clear();
        directory.clear();
      }
      return;
    }
    if (session.me || this.#loadingMe) return;
    this.#loadingMe = true;
    session
      .loadMe()
      .catch((error) => {
        bus.publish(APP_ERROR, error);
        // Only a refused login ends the session; a network blip or a 5xx keeps it (the error says to retry).
        if (error instanceof ProblemError && (error.status === 401 || error.status === 403)) return this.logout();
      })
      .finally(() => (this.#loadingMe = false));
  }

  /**
   * Work that runs while the shell is shown: live updates, feature hooks, reconnect triggers.
   * Returns the cleanup; call from an effect that depends on `screen === 'shell'`.
   */
  startSession(): () => void {
    const { live, features, session, directory, keyboard, bus } = this.deps;
    live.start();
    // Own teams' rosters: names and which profiles a coach may open (links, windows by URL).
    directory.loadRosters().catch(() => {});
    const detachKeyboard = keyboard.attach();
    const removeCommands = this.registerGlobalCommands();
    const wake = () => document.visibilityState === 'visible' && live.wake();
    addEventListener('online', wake);
    document.addEventListener('visibilitychange', wake);
    const stops = [
      features.start(),
      bus.subscribe(MEMBERSHIP_CHANGED, ({ data }) => {
        directory.forgetRoster(data.teamId);
        if (data.memberId === session.me?.member.id) void session.loadMe();
      }).unsubscribe,
      bus.subscribe(CLUB_CHANGED, ({ data }) => (session.club = data.club)).unsubscribe,
      detachKeyboard,
      removeCommands,
      () => removeEventListener('online', wake),
      () => document.removeEventListener('visibilitychange', wake),
    ];
    return () => {
      stops.forEach((stop) => stop());
      live.stop();
    };
  }

  /** App-wide commands: palette, settings, theme, navigation and window placement. */
  private registerGlobalCommands(): () => void {
    const { commands, windows, preferences, bus, backStack, split } = this.deps;
    const windowOpen = () => windows.current !== null;
    const navigation = Object.fromEntries(
      (Object.entries(SHORTCUTS) as [CommandId, (typeof SHORTCUTS)[CommandId]][])
        .filter(([, definition]) => 'path' in definition)
        .map(([id, definition]) => {
          const path = (definition as { path: string }).path;
          return [id, { run: () => this.deps.pageNavigator.go(path), when: () => this.allowedRoutes.some((r) => r.path === path) }];
        }),
    );
    return commands.register({
      ...navigation,
      'palette.open': { run: () => (commands.paletteOpen = !commands.paletteOpen) },
      'settings.open': { run: () => bus.publish(WINDOW_OPEN, { kind: 'settings', id: 'appearance' }), when: () => !!windows.content('settings') },
      'help.shortcuts': { run: () => bus.publish(WINDOW_OPEN, { kind: 'settings', id: 'shortcuts' }), when: () => !!windows.content('settings') },
      'sidebar.toggle': { run: () => preferences.set('sidebarCollapsed', !preferences.values.sidebarCollapsed) },
      'split.toggle': { run: () => split.toggle() },
      'split.swap': { run: () => split.swap(), when: () => split.isOpen },
      'theme.toggle': { run: () => preferences.toggleScheme(matchMedia('(prefers-color-scheme: dark)').matches) },
      'auth.logout': { run: () => void this.logout() },
      'nav.back': { run: () => history.back() },
      // Escape: leave the newest inner view (edit mode, panel), else the previous record, else close.
      'view.back': {
        run: () => (commands.paletteOpen ? (commands.paletteOpen = false) : backStack.back() || windows.back()),
        when: () => commands.paletteOpen || backStack.depth > 0 || windowOpen(),
      },
      'form.submit': { run: () => AppController.focusedForm()?.requestSubmit(), when: () => !!AppController.focusedForm() },
      'window.close': { run: () => bus.publish(WINDOW_CLOSE), when: windowOpen },
      'window.center': { run: () => windows.setDock('center'), when: windowOpen },
      'window.side': { run: () => windows.setDock('side'), when: windowOpen },
      'window.bottom': { run: () => windows.setDock('bottom'), when: windowOpen },
      'window.page': {
        run: () => {
          const current = windows.current;
          const page = current && windows.content(current.kind)?.page;
          if (current && page) windows.handle().navigate(page(current.id));
        },
        when: () => !!windows.current && !!windows.content(windows.current.kind)?.page,
      },
    });
  }

  /** First allowed route matching the path; pages differ in props, every page accepts PageProps (`params` may be ignored). */
  private resolve(path: string): ResolvedPage | null {
    for (const route of this.allowedRoutes) {
      const params = Router.match(route.path, path);
      if (params) return { component: route.component as Component<PageProps>, params, label: route.nav ?? null };
    }
    return null;
  }

  /** The form that holds the focus, if any (Mod+Enter saves it). */
  private static focusedForm(): HTMLFormElement | null {
    return document.activeElement instanceof HTMLElement ? document.activeElement.closest('form') : null;
  }

  async logout(): Promise<void> {
    const { auth, session, directory, bus, pendingDeletes, forgetUser } = this.deps;
    await pendingDeletes.flush(); // deletes the member already confirmed, while their token still works
    await auth.signOut();
    session.clear();
    directory.clear();
    forgetUser();
    bus.publish(NAVIGATE, { path: '/' });
  }

  private computeScreen(): Screen {
    const { auth, session, router } = this.deps;
    if (this.failure) return 'failed';
    if (!auth.ready || !session.club) return 'loading';
    const path = router.path;
    if (path === AUTH_PATHS.setPassword && auth.signedIn) return 'set-password';
    if (!auth.signedIn) return path === AUTH_PATHS.forgotPassword ? 'forgot-password' : 'login';
    if (!session.me) return 'loading';
    if (session.me.missing.length) return 'onboarding';
    // A fresh install: the first admin enters the club before anyone works in the app.
    return !session.club.configured && session.hasRole('ADMIN') ? 'setup' : 'shell';
  }
}
