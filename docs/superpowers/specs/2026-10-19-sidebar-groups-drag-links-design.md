# Sidebar groups, Events list, drag-to-link, Benötigt layout, photo person filter

Date: 2026-10-19. Repos: club-client (all parts), club-server (part 3 only: new message ref kinds).

## Why

The sidebar has grown to 11 flat tabs; related areas should sit together so it stays übersichtlich.
Linking records (to a message, an appointment, a task, a photo) today means searching for something
that is already visible on screen in the other split pane. Dragging it over is faster.
Two smaller fixes: the "Benötigt" stock places are hard to read, and photos can't be narrowed to people.

## 1. Sidebar groups (decided with the user)

Layout, default order:

```
Start
Benachrichtigungen   (badge)
Aufgaben
Kalender
▸ Events   → Events · Turniere
▸ Verein   → Teams · Mitglieder · Orte
▸ Ablage   → Dateien · Inventar
Logs       (privileged only)
───────
Einstellungen (footer, unchanged)
```

- A group is a sidebar row with icon + label. Hovering it opens a flyout to the right with its tabs,
  with a clean slide/fade animation (use the `Motion` presets / `settings.motion` timing; collapses to
  0 ms with reduced motion). A short close delay so moving the mouse into the flyout doesn't close it.
- Clicking the group label opens its first visible tab (user decision).
- Role filtering first, then grouping: a group with exactly one visible tab renders as that plain tab;
  a group with none is hidden. (Plain member: Verein = Teams, Orte; Ablage = Dateien only → plain tab.
  Guests: no groups.)
- The group row shows the active highlight when one of its tabs is the current page; badges of child
  tabs add up on the group row.
- Members still reorder in Einstellungen > Startseite/Seitenleiste, but only top-level rows: tabs and
  groups. Order inside a group is fixed (user decision). Stored order keeps being a list of keys; a group's
  key is `group:<id>`. *My call:* for an old stored order without `group:<id>`, the group takes the place
  of its first member path found in that order (else its default place); grouped paths are then ignored.
- Keyboard: group row focusable; Enter = first tab, ArrowRight / Space opens the flyout, Escape closes it,
  arrow keys move inside. Flyout is also reachable on click-and-hold-free devices.
- Collapsed desktop sidebar (icons only): same flyout, with the group label as flyout header.
- Compact/phone overlay (no hover): *builder's call, proposed:* the group expands inline as an accordion.
- The "In geteilter Ansicht öffnen" context menu stays on every tab, including tabs inside a flyout.
- Groups are declared once (id, label, icon, member route paths), e.g. next to the feature list in
  `src/features/index.ts`; features themselves stay unaware of groups.

## 2. Events tab; Kalender loses its list view (user decision)

- New tab "Events" (route `/events`, owned by the calendar feature, inside group Events).
- Lists appointments only (Training, Spiele, Termine) that the member can see — no task due dates, no
  tournaments (they keep their own tab). User decision.
- Default: upcoming (today → +365 days, `CalendarApi.list` caps at 366 days). A switch shows past ones
  (−365 days → today). Standard `ListModel` + `DataTable` with search, sort, team filter, type tag,
  cancelled ones struck through (as the old list did). Opens the appointment window; "Neuer Termin" for
  those who may create. Live reload on `APPOINTMENTS_CHANGED`.
- Kalender: remove the `list` view entirely — `CALENDAR_VIEWS`, `CalendarListModel`, the
  `calendar.list` shortcut/command, `rangeOf`/`step` list branches, related tests. A stored preference
  or URL `?view=list` falls back to month.

## 3. Drag records to link them

One shared drag payload for "a record": kind, id, title (+ parent id for files). Same document, so it
works between split panes, the window and the page.

**Sources** (everything that shows a record): `RecordLink` (so every clickable name, incl. `MemberName`),
`DataTable` rows of record lists (members, teams, locations, items, tasks, events, tournaments, files),
calendar entry chips (appointments; task chips as tasks), file gallery tiles. Existing drags keep working
(files onto folders, moving entries in the calendar) — the record payload is added alongside.

**Targets** (user chose all three):
1. New Benachrichtigung (`MessageComposeView`): drop any record → added under "Verknüpfen"
   (`MessageForm.addRef`), respecting `maxRefs` and duplicates.
2. Benötigt / Dateien editor (`LinksSection` in edit mode, appointments and tasks): an item → `addItem`,
   a file → `addFile`. Other kinds are refused (no-drop cursor).
3. Photos & assignees: a member dropped on a photo (gallery tile or open photo) opens the existing
   `TagEditor` with that person already added; the user still presses Speichern (user decision). Only where
   the viewer may tag; a person outside the editor's candidates is refused. A member dropped on a task's
   assignee editor adds them.

A target highlights while something it accepts is dragged over it; it shows a no-drop cursor otherwise.

**Server (club-server):** message refs today allow `TASK, APPOINTMENT, ITEM, FILE, MEMBER`
(`NotificationsApi.RefKind`). Add `TEAM, LOCATION, TOURNAMENT`, resolved in `MessageHandlers` through
`TeamsApi`/`LocationsApi`/`TournamentsApi` with the sender's visibility (404 rules as for the others),
plus a Flyway migration if the kind is constrained in the DB. *My call:* a TEAM ref follows the team list
rule (`TeamsApi.LIST`, every member sees every team), not the roster rule, so any team can be linked.
Global search (`SearchController`, `HitKind`) gains `LOCATION` and `TOURNAMENT`, each module answering with
its own visibility (user decision); so the "Verknüpfen" search finds them too. Client: `RefKind`,
`REF_ICONS`, `refWindow`, `HitKind`/`kindLabel`, `MessageRefPicker` search kinds, mocks. Recipients who can't see a ref get the same treatment
as existing kinds.

Non-goal: touch drag on phones (HTML5 drag & drop doesn't work there); dragging out of the browser.

## 4. Benötigt read layout

In `LinksSection` read mode, the stock places ("Halle 1 3 · Clara Trainer 2") move from the full-width
line below the row to the right column, under the needed amount / "von N im Inventar", small and muted.
A person place is a `MemberName` link (opens the profile when the viewer may); "bei dir" stays bold;
locations stay `RecordLink`s. Applies to appointments and tasks (shared component).

## 5. Photo filter by people (user decision: open folder only)

In a folder with photos, a "Personen" filter offers the people tagged in that folder's photos
(`taggedMemberIds`); choosing one or more shows only photos containing *all* chosen people (*my call:
AND, since "photos that contain these persons"*). Client-only, no server change. Works in the gallery
and the table view of the folder; cleared when changing folder.

## Left to the builder

Exact flyout animation and spacing (within the existing tokens), file/class names, accordion detail on
phones, payload MIME type name, where group definitions live, test choice (one test per non-trivial
piece: group collapse/order logic, Events list model, drag payload, message ref kinds server-side, photo
filter).
