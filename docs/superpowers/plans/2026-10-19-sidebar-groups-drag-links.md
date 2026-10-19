# Sidebar groups, Events list, drag-to-link, Benötigt layout, photo filter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the five parts of the spec in club-client, plus new message ref kinds and search kinds in club-server.

**Architecture:** Sidebar grouping is computed in `FeatureRegistry.navigation` from a group table in `features/index.ts`; `Sidebar.svelte` renders groups as flyouts. Drag uses one record payload (`lib/records/RecordDrag.ts`) set by `RecordLink`, `DataTable` rows, calendar chips and gallery tiles, read by four drop targets. Server: `RefKind` + `HitKind` get new values resolved over the bus.

**Tech Stack:** Svelte 5 runes, TypeScript, vitest; Java 21, Spring Boot 4, JdbcClient, Testcontainers.

**Spec:** `docs/superpowers/specs/2026-10-19-sidebar-groups-drag-links-design.md`

## Global Constraints

- German UI copy; labels: groups "Events", "Verein", "Ablage"; tab "Events".
- Default top-level order: Start, Benachrichtigungen, Aufgaben, Kalender, group:events, group:verein, group:ablage, Logs; Einstellungen stays footer.
- Groups: events = [/events, /tournaments]; verein = [/teams, /members, /locations]; ablage = [/files, /inventory].
- Animation timing only from `settings.motion` / CSS motion tokens; 0 ms with reduced motion.
- Features never import each other (except existing allowed lib/ui use). Server: modules talk only via the bus.
- Every non-trivial new logic gets one test.

## Review Focus

- Group whose children are all hidden by role → no row at all (test in Task 1).
- Stored `navOrder` from before groups → group placed at first member path (test in Task 1).
- `?view=list` / stored `calendarView: 'list'` → month, no crash (test in Task 2).
- Dropping a record that is already linked / beyond `maxRefs` → no duplicate, no error (test in Task 3).
- Dragging a file row onto a folder still moves it (existing FolderActions/files tests stay green).

---

### Task 1: Sidebar groups (client)

**Files:** Modify `src/features/FeatureRegistry.ts`, `src/features/index.ts`, `src/lib/navigation/NavCatalog.ts`, `src/ui/Sidebar.svelte`, `src/features/settings/SidebarSection.svelte`, `src/AppController.svelte.ts` (if signature changes). Test: `src/lib/navigation/NavCatalog.test.ts`.

**Interfaces — Produces:**
- `interface NavGroup { id: string; label: string; icon: IconName; paths: readonly string[] }`
- `NavItem` gains `key: string` and `children?: NavItem[]` (group rows: `key = 'group:<id>'`, `path` = first visible child path, `badge` = sum).
- `new FeatureRegistry(features, { groups, order })`; `navigation(allowed, order)` returns top-level items with groups collapsed (1 child → that child, 0 → none).
- `NavCatalog.ordered` returns top-level entries `{ key, label }` incl. groups.

- [ ] Tests: groups collapse by role; single-child group becomes plain tab; default order as Global Constraints; old order `['/teams','/']` puts group:verein first; catalog lists groups once.
- [ ] Implement; sidebar flyout (hover with close delay, click → first child, keyboard, collapsed sidebar, compact = inline accordion), context menu per child.
- [ ] `npm run check && npm test` green; commit.

### Task 2: Events tab, remove calendar list view (client)

**Files:** Create `src/features/calendar/EventsPage.svelte`, `src/features/calendar/EventListModel.svelte.ts`; modify `feature.ts`, `CalendarPage.svelte`, `CalendarModel.svelte.ts`, `src/shortcuts.ts`, delete `CalendarListModel.svelte.ts`; tests `CalendarModel.test.ts`, new `EventListModel` case.

**Interfaces — Produces:** route `/events` (nav 'Events', icon calendar-ish); `EventListModel extends ListModel<Appointment>` with `past: boolean` toggle loading `calendarApi.list(from, to, null)` for [today, +365d) or [−365d, today).

- [ ] Tests: `CalendarModel` with view 'list' → 'month'; EventListModel range for upcoming/past.
- [ ] Implement; remove list view code + `calendar.list` command; verify; commit.

### Task 3: Record drag payload + message drop + new ref/search kinds (client + server)

**Files (client):** create `src/lib/records/RecordDrag.ts` (+ test); modify `ui/RecordLink.svelte`, `ui/DataTable.svelte` (optional `record?: (row) => RecordRef`), list pages that pass it, `features/calendar/EntryChip.svelte`, `features/files/FolderGallery.svelte`, `features/notifications/MessageComposeView.svelte`, `model.ts` (RefKind, REF_ICONS, refWindow), `MessageRefPicker.svelte`, `features/search/model.ts`, mocks.
**Files (server):** `notifications/api/NotificationsApi.java` (RefKind + TEAM, LOCATION, TOURNAMENT), `notifications/application/MessageHandlers.java#resolve`, `gateway/rest/SearchController.java` (HitKind + LOCATION, TOURNAMENT), `MessagesIT`, `SearchIT`, CLAUDE.md search line.

**Interfaces — Produces:**
- `type RecordKind = 'appointment'|'task'|'file'|'item'|'member'|'team'|'location'|'tournament'` (window kinds).
- `interface RecordRef { kind: RecordKind; id: string; title: string }` (file id = `folderId:fileId` like windows).
- `RecordDrag.TYPE`, `RecordDrag.set(event, ref)`, `RecordDrag.has(event)`, `RecordDrag.get(event): RecordRef | null`.

- [ ] Tests: RecordDrag round-trip + rejects garbage; MessageForm addRef duplicate/max; server MessagesIT links TEAM/LOCATION/TOURNAMENT; SearchIT finds a location and a tournament.
- [ ] Implement; `mvn -B verify` + client checks green; commit both repos.

### Task 4: Drop on Benötigt/Dateien, photos, assignees (client)

**Files:** `ui/LinksSection.svelte` (edit mode: item → `model.addItem`, file → `model.addFile`), `features/files/PhotoView.svelte` + `TagEditor.svelte` (initial extra member), `FolderGallery.svelte` tile drop → open photo with tag editor, `features/tasks/AssigneePicker.svelte` (member → add).

- [ ] Implement with `RecordDrag`; drop zones highlight; foreign kinds refused. check/test green; commit.

### Task 5: Benötigt layout + photo person filter (client)

**Files:** `ui/LinksSection.svelte` (places in right column, `MemberName` for PERSON); files folder view (`FilesPage.svelte`/`FolderGallery.svelte`/folder contents model) — "Personen" filter, AND semantics, reset on folder change; test for the filter function.

- [ ] Test filter; implement; check/test green; commit.
