# club-client

Website for [club-server](../club-server). Svelte 5 + Vite, no UI framework, German UI.

```bash
npm install
npm run dev      # http://localhost:5173, mock mode: fake API + dev login, no services needed
npm run check    # svelte-check (types, a11y)
npm test         # vitest
npm run build    # dist/, deployed to GitHub Pages by .github/workflows/deploy.yml
```

## Modes
`VITE_API_MODE` (see `.env.example`):
- `mock` (default): the API is answered in the browser (`src/lib/mock`, `src/features/*/mock.ts`), and data is kept in localStorage. The login page lists test accounts. Privileged accounts use PIN `73915`. To reset the data, clear the site data.
- `http`: real club-server + Supabase login. Needs `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. `src/lib/auth/SupabaseAuthProvider.ts` is still a stub.

## Event bus
`src/lib/bus/` is a TypeScript port of the Java EventBus (`../EventBus`): hierarchical channels (`domain/tasks/task-changed`), priorities, `Subscription` handles, request/response with timeouts, dead letters and a debug history (`window.__bus` in dev). One app bus (`bus` in the container) carries everything that is an event or a command:

- Server events: `LiveUpdates` publishes each pushed event on `domain/<module>/<event>`. Features declare typed tokens in `events.ts` (`TASK_CHANGED = liveEvent<TaskChanged>('tasks.task-changed')`) and subscribe with `useBus(bus, TASK_CHANGED, handler)`.
- UI commands (`src/channels.ts`): `TOAST`, `APP_ERROR` (error toast with the readable text), `CONFIRM` (request, resolves true/false), `WINDOW_OPEN`/`WINDOW_CLOSE`, `NAVIGATE`. The owning service subscribes in its constructor; callers never import the service.
- The mock server runs its own bus instance (`MockEventBus`), like club-server runs the Java one.

Reactive state is still read directly from services where it is rendered (`session`, `windows.current`); data access stays in the feature API classes.

## Structure
- `src/settings.ts`: every website parameter in one place. That covers theme tokens (colours, radius, spacing, fonts, layout), the compact breakpoint, timing, server-mirrored limits and storage keys. `ThemeService` turns the theme into CSS custom properties at startup; stylesheets use only `var(--...)`.
- `src/lib/container.ts`: composition root. It creates the `bus` first, then each shared service once (`api`, `auth`, `session`, `router`, `stepUp`, `toasts`, `errors`, `theme`, `motion`) and wires their dependencies.
- `src/lib/`: framework-free core classes.
  - `http/`: `ApiClient`, `HttpTransport`, `ProblemError`, plus the `Transport` interface.
  - `auth/`: the `AuthProvider` interface with `DevAuthProvider` and `SupabaseAuthProvider`, and `AuthService`.
  - `router/`, `session/`, `security/` (step-up), `notify/`, `errors/` (`ErrorMessages` registry).
  - `time/`: `ZonedClock` for club time-zone conversion and `Formatter`.
  - `state/`: `Resource` for async reads and `Action` for writes.
  - `detail/`: `DetailController` (window title, leave, confirmed writes, live watch of the shown record), `EditSession` (edit form + save) and `CreateController` ("new" windows). Every record view builds on these.
  - `motion/`: `Motion` transition presets (`rise`, `pop`, `slide`, `fade`, stagger, View Transitions) on the timing in `settings.motion`; all collapse to 0 ms with reduced motion.
  - `mock/`: `MockServer`, `MockTable` and the core `MockDirectory`.
- `src/ui/`: presentational components with no business logic:
  - `DataTable` + `ListToolbar` render every list (search, filters, sort).
  - `WindowHost` renders the single detail window; it can be centered or docked to the side or the bottom, the placement is remembered and the window is in the URL as `?open=kind/id`.
  - `Detail` and `DetailPage` lay out detail views. `Select`, `Button`, `Tag` and `Field` keep all controls consistent.
  - `RecordLink` / `MemberName` make names of records clickable (open in the window, with a way back inside one); without permission they stay plain text or the generic placeholder.
  - `SortableList` reorders entries by drag and drop or keyboard (sidebar order, start page sections).
  - `PeoplePicker` chooses people (photo tags, task assignees) in the standard list with checkboxes (`DataTable` `check`, `PersonListModel`).
  - `Icon` renders the house icon set from `src/icons.ts` (Lucide). Use icons only where they carry meaning: navigation, add/edit/delete, window controls, search, status.
- `src/lib/list/ListModel.svelte.ts`: the generic list (columns, client and server filters, sort, search, remembered state). Each list is a subclass with its own definition (e.g. `TaskListModel`).
- `src/lib/window/WindowService.svelte.ts`: opens, closes and docks the detail window. Features register their window kinds in `Feature.windows`.
- `src/lib/calendar/CalendarSources.ts`: features contribute calendar entries through `Feature.calendar` (appointments, task due dates) without importing each other.
- `src/features/<name>/`: one folder per feature. Each has a `feature.ts` with routes and error messages, plus its API service, policy, view-model classes (`*.svelte.ts`), pages and `mock.ts`. Features import `lib/` and `ui/`, never each other.
- `src/AppController.svelte.ts`: start-up, screen selection (login, onboarding, shell) and page resolution.

## Adding a feature
1. `src/features/<name>/feature.ts` exports a `Feature` with `routes` and optional `messages`. A route with `nav` appears in the sidebar; `roles` restricts it. List specific paths before parameter paths.
2. Add a service class for the endpoints that takes `ApiClient`, with DTO types in `model.ts`. Instantiate it in `services.ts` from the container.
3. Put page state in view-model classes (`Resource`, `Action`, `$state`/`$derived` fields). Keep pages thin.
4. `mock.ts` registers fake endpoints with `mockServer.on(...)`. It is loaded automatically in mock mode. After a write, it publishes the server's event with `mockServer.events.publish({ type, data, audience })`. Events without an `audience` stay inside the mock server, for other mock modules.
   Start page sections: `Feature.home` (`id`, `label`, `component`); members order and hide them in Einstellungen > Startseite.
5. Access: routes and windows take `roles` (windows also `canOpen(id)` for per-record rules); a window the member may not open does not appear, also when opened by URL or notification link. The server decides as well, so restrict both.
5. Lists extend `ListModel` and render with `DataTable`. Details are window contents (`{ id, handle }` props) registered in `Feature.windows`, plus an optional full-page route that wraps the same view in `DetailPage`.
6. Live updates: declare the event in `events.ts` with `liveEvent<T>('<module>.<event>')`, then call `useBus(bus, EVENT, handler)` in a page and reload what it shows (record views use `DetailController.watch`). Commands go over the bus too: `bus.publish(TOAST, { text })`, `await bus.request(CONFIRM, {...})`.
   Escape means "one view back": any inner state (edit mode, inline editor, panel) registers `backStack.while(() => open, () => close())`; `EditSession` does this itself and asks before discarding typed changes. With no inner state left, Escape returns to the record previously shown in the window (opened from inside it with `DetailController.open`), then closes the window. Shift+Escape closes it directly; Mod+Enter submits the focused form. Optional `Feature` fields: `links` maps server links from notifications to routes, `start` runs while signed in, and a route's `badge` adds a count in the sidebar.
7. Add the feature to `src/features/index.ts`. New tunable values go into `src/settings.ts`.

## Deploy (GitHub Pages)
Repo Settings → Pages → Source: GitHub Actions. Push to `main` builds in mock mode and deploys.
Going live later: set repo variables `VITE_API_MODE=http` and the three URLs/keys, add the Pages origin to the server's `CORS_ALLOWED_ORIGINS` and to the Supabase redirect URLs.
