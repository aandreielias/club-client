/**
 * Composition root: creates every shared service once and wires their dependencies.
 * Components and features import services from here; nothing else constructs them.
 */
import { settings } from '../settings';
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
import { ToastService } from './notify/ToastService.svelte';
import { ClubPermissions } from './policy/ClubPermissions';
import { CalendarSources } from './calendar/CalendarSources';
import { LinkResolver } from './router/LinkResolver';
import { NavCatalog } from './navigation/NavCatalog';
import { Router } from './router/Router.svelte';
import { StepUpService } from './security/StepUpService.svelte';
import { SessionStore } from './session/SessionStore.svelte';
import { LocalStore } from './storage/LocalStore';
import { CommandRegistry } from './keyboard/CommandRegistry.svelte';
import { KeyboardService } from './keyboard/KeyboardService.svelte';
import { Keymap } from './keyboard/Keymap.svelte';
import { PreferencesService } from './preferences/PreferencesService.svelte';
import { ThemeService } from './theme/ThemeService';
import { WindowService } from './window/WindowService.svelte';
import { LinksApi } from './links/LinksApi';
import { ContextMenuService } from './overlay/ContextMenuService.svelte';
import { TooltipService } from './overlay/TooltipService.svelte';
import { LINK_MESSAGES } from './links/messages';
import type { StepUp } from './types';

const { runtime } = settings;

export const store = new LocalStore(settings.storage.prefix);

export const theme = new ThemeService(settings.theme, settings.compactBelowPx);

export const preferences = new PreferencesService(
  settings.appearance,
  { scheme: settings.theme.scheme, calendarView: settings.calendar.defaultView },
  store,
  () => theme.apply(preferences.themeOverrides()),
);

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

export const router = new Router();

export const links = new LinkResolver();

export const windows = new WindowService(router, store, settings.window.defaultDock);

export const calendarSources = new CalendarSources();

/** "Benötigt" lists and attachments of appointments and tasks. */
export const linksApi = new LinksApi(api);

export const navCatalog = new NavCatalog();

export const confirmation = new ConfirmService();

export const toasts = new ToastService(settings.notify.toastMs, settings.notify.errorToastMs);

export const tooltips = new TooltipService(settings.overlay.tooltipDelayMs, settings.overlay.tooltipSkipDelayMs);

export const contextMenu = new ContextMenuService();

export const errors = new ErrorMessages(STATUS_MESSAGES, UNKNOWN_MESSAGE).register(CORE_MESSAGES).register(LINK_MESSAGES);

const openSocket: SocketFactory =
  runtime.apiMode === 'http'
    ? webSocketFactory(runtime.apiUrl, settings.live.path)
    : async () => (await import('./mock')).createMockSocket();

export const live = new LiveUpdates(openSocket, auth.token, settings.live, () => {
  // The server closes with 4403 when the member was deactivated: end the session here as well.
  toasts.error('Dein Zugang ist nicht mehr aktiv.');
  void auth.signOut();
});
