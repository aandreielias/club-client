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
import { APP_ERROR, NAVIGATE, WINDOW_CLOSE, WINDOW_OPEN } from './channels';
import { MEMBERSHIP_CHANGED } from './features/teams/events';
import type { RouteParams, Router } from './lib/router/Router.svelte';
import type { SessionStore } from './lib/session/SessionStore.svelte';

/** Which top-level screen the app shows; derived from auth, profile and route state. */
export type Screen = 'failed' | 'loading' | 'set-password' | 'forgot-password' | 'login' | 'onboarding' | 'shell';

export const AUTH_PATHS = { setPassword: '/set-password', forgotPassword: '/forgot-password' } as const;

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
}

/** Drives start-up, login/logout transitions, the signed-in session and page resolution for App.svelte. */
export class AppController {
  failure = $state<string | null>(null);

  readonly screen: Screen;
  readonly allowedRoutes: FeatureRoute[];
  readonly navigation: NavItem[];
  readonly page: { component: Component<PageProps>; params: RouteParams } | null;

  #loadingMe = false;

  constructor(private readonly deps: AppDependencies) {
    const { features, session, router } = deps;
    this.screen = $derived.by(() => this.computeScreen());
    this.allowedRoutes = $derived(features.allowed((...roles) => session.hasRole(...roles)));
    this.navigation = $derived(features.navigation(this.allowedRoutes, deps.preferences.values.navOrder));
    this.page = $derived.by(() => {
      const match = router.resolve(this.allowedRoutes);
      // Pages differ in props; every page accepts PageProps (`params` may be ignored).
      return match ? { component: match.route.component as Component<PageProps>, params: match.params } : null;
    });
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
        return this.logout();
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
    const { commands, windows, preferences, bus } = this.deps;
    const windowOpen = () => windows.current !== null;
    const navigation = Object.fromEntries(
      (Object.entries(SHORTCUTS) as [CommandId, (typeof SHORTCUTS)[CommandId]][])
        .filter(([, definition]) => 'path' in definition)
        .map(([id, definition]) => {
          const path = (definition as { path: string }).path;
          return [id, { run: () => bus.publish(NAVIGATE, { path }), when: () => this.allowedRoutes.some((r) => r.path === path) }];
        }),
    );
    return commands.register({
      ...navigation,
      'palette.open': { run: () => (commands.paletteOpen = !commands.paletteOpen) },
      'settings.open': { run: () => bus.publish(WINDOW_OPEN, { kind: 'settings', id: 'appearance' }), when: () => !!windows.content('settings') },
      'help.shortcuts': { run: () => bus.publish(WINDOW_OPEN, { kind: 'settings', id: 'shortcuts' }), when: () => !!windows.content('settings') },
      'theme.toggle': { run: () => preferences.toggleScheme(matchMedia('(prefers-color-scheme: dark)').matches) },
      'auth.logout': { run: () => void this.logout() },
      'nav.back': { run: () => history.back() },
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

  async logout(): Promise<void> {
    const { auth, session, directory, bus } = this.deps;
    await auth.signOut();
    session.clear();
    directory.clear();
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
    return session.me.missing.length ? 'onboarding' : 'shell';
  }
}
