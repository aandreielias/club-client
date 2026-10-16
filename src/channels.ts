/**
 * App-wide event bus channels in one place. Each service owns its channel; this file only gathers
 * them so components import commands from one module. Feature server events live in features/<x>/events.ts.
 */
export { APP_ERROR } from './lib/errors/ErrorReporter';
export { CONFIRM, type ConfirmRequest } from './lib/notify/ConfirmService.svelte';
export { TOAST, type ToastRequest } from './lib/notify/ToastService.svelte';
export { NAVIGATE } from './lib/router/Router.svelte';
export { WINDOW_CLOSE, WINDOW_OPEN } from './lib/window/WindowService.svelte';
