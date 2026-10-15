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

## Structure
- `src/settings.ts`: every website parameter in one place. That covers theme tokens (colours, radius, spacing, fonts, layout), the compact breakpoint, timing, server-mirrored limits and storage keys. `ThemeService` turns the theme into CSS custom properties at startup; stylesheets use only `var(--...)`.
- `src/lib/container.ts`: composition root. It creates each shared service once (`api`, `auth`, `session`, `router`, `stepUp`, `toasts`, `errors`, `theme`) and wires their dependencies.
- `src/lib/`: framework-free core classes.
  - `http/`: `ApiClient`, `HttpTransport`, `ProblemError`, plus the `Transport` interface.
  - `auth/`: the `AuthProvider` interface with `DevAuthProvider` and `SupabaseAuthProvider`, and `AuthService`.
  - `router/`, `session/`, `security/` (step-up), `notify/`, `errors/` (`ErrorMessages` registry).
  - `time/`: `ZonedClock` for club time-zone conversion and `Formatter`.
  - `state/`: `Resource` for async reads and `Action` for writes.
  - `mock/`: `MockServer`, `MockTable` and the core `MockDirectory`.
- `src/ui/`: presentational components with no business logic:
  - `DataTable` + `ListToolbar` render every list (search, filters, sort).
  - `WindowHost` renders the single detail window; it can be centered or docked to the side or the bottom, the placement is remembered and the window is in the URL as `?open=kind/id`.
  - `Detail` and `DetailPage` lay out detail views. `Select`, `Button`, `Tag` and `Field` keep all controls consistent.
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
5. Lists extend `ListModel` and render with `DataTable`. Details are window contents (`{ id, handle }` props) registered in `Feature.windows`, plus an optional full-page route that wraps the same view in `DetailPage`.
6. Live updates: in a page, call `onLive(live, '<module>.<event>', handler)` (`lib/live/onLive.svelte.ts`) and reload what the page shows. Optional `Feature` fields: `links` maps server links from notifications to routes, `start` runs while signed in, and a route's `badge` adds a count in the sidebar.
7. Add the feature to `src/features/index.ts`. New tunable values go into `src/settings.ts`.

## Deploy (GitHub Pages)
Repo Settings → Pages → Source: GitHub Actions. Push to `main` builds in mock mode and deploys.
Going live later: set repo variables `VITE_API_MODE=http` and the three URLs/keys, add the Pages origin to the server's `CORS_ALLOWED_ORIGINS` and to the Supabase redirect URLs.
