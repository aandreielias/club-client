/**
 * Composition root: creates every shared service once and wires their dependencies.
 * Components and features import services from here; nothing else constructs them.
 */
import { ActivityApi } from './activity/ActivityApi';
import { settings } from '../settings';
import { EventBusBuilder } from './bus';
import { ErrorReporter } from './errors/ErrorReporter';
import { AuthService } from './auth/AuthService.svelte';
import { DevAuthProvider } from './auth/DevAuthProvider';
import { SupabaseAuthProvider } from './auth/SupabaseAuthProvider';
import { CORE_MESSAGES, STATUS_MESSAGES, UNKNOWN_MESSAGE } from './errors/coreMessages';
import { TeamDirectory } from './directory/TeamDirectory.svelte';
import { ErrorMessages } from './errors/ErrorMessages';
import { ApiClient } from './http/ApiClient';
import { HttpTransport } from './http/HttpTransport';
import { LazyTransport, type Transport } from './http/Transport';
import { webSocketFactory, type SocketFactory } from './live/LiveSocket';
import { LiveUpdates } from './live/LiveUpdates.svelte';
import { ConfirmService } from './notify/ConfirmService.svelte';
import { TOAST, ToastService } from './notify/ToastService.svelte';
import { ClubPermissions } from './policy/ClubPermissions';
import { CalendarSources } from './calendar/CalendarSources';
import { HomeSections } from './home/HomeSections';
import { LinkResolver } from './router/LinkResolver';
import { NavCatalog } from './navigation/NavCatalog';
import { BackStack } from './navigation/BackStack.svelte';
import { PendingDeletes } from './state/PendingDeletes.svelte';
import { ScrollMemory } from './navigation/ScrollMemory';
import { DocumentTitle } from './navigation/DocumentTitle.svelte';
import { Router } from './router/Router.svelte';
import { StepUpService } from './security/StepUpService.svelte';
import { SessionStore } from './session/SessionStore.svelte';
import { LocalStore } from './storage/LocalStore';
import { CommandRegistry } from './keyboard/CommandRegistry.svelte';
import { KeyboardService } from './keyboard/KeyboardService.svelte';
import { Keymap } from './keyboard/Keymap.svelte';
import { PreferencesService } from './preferences/PreferencesService.svelte';
import { ThemeService } from './theme/ThemeService';
import { Motion } from './motion/Motion.svelte';
import { WindowService } from './window/WindowService.svelte';
import { RecentRecords } from './window/RecentRecords.svelte';
import { LinksApi } from './links/LinksApi';
import { MainPane, SplitPane } from './split/Pane';
import { SplitView } from './split/SplitView.svelte';
import { ContextMenuService } from './overlay/ContextMenuService.svelte';
import { TooltipService } from './overlay/TooltipService.svelte';
import { LINK_MESSAGES } from './links/messages';
import type { StepUp } from './types';

const { runtime } = settings;

/** The app's central event bus: server events, UI commands and app events all travel over it. */
export const bus = EventBusBuilder.create()
  .withHierarchicalRouting()
  .withDefaultRequestTimeout(settings.bus.requestTimeoutMs)
  .withMaxHistorySize(import.meta.env.DEV ? settings.bus.historySize : 0)
  .build();

// Debug access in development: window.__bus.registry.history()
if (import.meta.env.DEV && typeof window !== 'undefined') Object.assign(window, { __bus: bus });

export const store = new LocalStore(settings.storage.prefix);

export const theme = new ThemeService(settings.theme, settings.compactBelowPx);

export const preferences = new PreferencesService(
  settings.appearance,
  { scheme: settings.theme.scheme, calendarView: settings.calendar.defaultView, filesView: settings.files.defaultView },
  store,
  () => theme.apply(preferences.themeOverrides()),
);

/** Shared transition presets; respects reduced motion (device and member preference). */
export const motion = new Motion(settings.motion, () => preferences.values.reduceMotion);

export const commands = new CommandRegistry();

export const keymap = new Keymap(store);

export const keyboard = new KeyboardService(
  commands,
  keymap,
  settings.keyboard.sequenceTimeoutMs,
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
);

export const auth = new AuthService(
  runtime.apiMode === 'http' ? new SupabaseAuthProvider(runtime.supabaseUrl, runtime.supabaseKey) : new DevAuthProvider(store),
);

const transport: Transport =
  runtime.apiMode === 'http'
    ? new HttpTransport(runtime.apiUrl, auth.token)
    : // Loaded on first use, so mock code and seed data never ship in an http build.
      new LazyTransport(
        async () => (await import('./mock')).createMockTransport(auth.token),
        settings.api.mockOrigin,
      );

export const stepUp: StepUpService = new StepUpService((pin) => api.post<StepUp>('/api/v1/me/step-up', { pin }));

export const api: ApiClient = new ApiClient(transport, () => stepUp.request());

export const session = new SessionStore(api);

export const directory = new TeamDirectory(api, session);

export const permissions = new ClubPermissions(session, directory);

/** Browser tab title, kept by Page, WindowHost and App. */
export const documentTitle = new DocumentTitle(() => session.club?.name ?? '');

/** Escape steps (edit modes, panels) of whatever is open; see the `view.back` command. */
export const backStack = new BackStack();

export const router = new Router(bus, (change) => motion.transition(change), () => backStack.mayLeave());

export const links = new LinkResolver();

/** A second page next to the main one (`?split=` in the URL). */
export const split = new SplitView(router, store, bus, settings.split);
export const mainPane = new MainPane(router, split);
export const splitPane = new SplitPane(split);

export const windows = new WindowService(router, store, settings.window.defaultDock, bus, () => backStack.mayLeave(), (roles) => session.hasRole(...roles));

/** Scroll position per page, restored when coming back. */
export const scrollMemory = new ScrollMemory(settings.scrollRestoreMs);

/** Records opened in the window, for the command palette. */
export const recentRecords = new RecentRecords(store, settings.window.recentRecords);

export const calendarSources = new CalendarSources();

/** Start page sections of the features (e.g. notifications). */
export const homeSections = new HomeSections();

/** "Benötigt" lists and attachments of appointments and tasks. */
export const linksApi = new LinksApi(api);
export const activityApi = new ActivityApi(api);

export const navCatalog = new NavCatalog();

export const confirmation = new ConfirmService(bus);

export const toasts = new ToastService(bus, settings.notify.toastMs, settings.notify.errorToastMs);

/** Deletes with undo instead of a confirmation. */
export const pendingDeletes = new PendingDeletes(bus, settings.notify.undoMs);

export const tooltips = new TooltipService(settings.overlay.tooltipDelayMs, settings.overlay.tooltipSkipDelayMs);

export const contextMenu = new ContextMenuService();

export const errors = new ErrorMessages(STATUS_MESSAGES, UNKNOWN_MESSAGE).register(CORE_MESSAGES).register(LINK_MESSAGES);

new ErrorReporter(bus, errors);

const openSocket: SocketFactory =
  runtime.apiMode === 'http'
    ? webSocketFactory(runtime.apiUrl, settings.live.path)
    : async () => (await import('./mock')).createMockSocket();

export const live = new LiveUpdates(openSocket, auth.token, settings.live, bus, () => {
  // The server closes with 4403 when the member was deactivated: end the session here as well.
  bus.publish(TOAST, { text: 'Dein Zugang ist nicht mehr aktiv.', tone: 'error' });
  void auth.signOut();
});
