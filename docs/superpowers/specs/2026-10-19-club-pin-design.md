# One club PIN instead of personal PINs

Date: 2026-10-19. Repos: club-server and club-client.

## Why
The club wants one shared PIN for step-up (privileged actions), handed to the people who need it in
person (no internet), and changed by admin or board from time to time. Personal PINs go away.

Security trade-off (told to the user and accepted): one leaked PIN opens step-up for every privileged
account; actions stay attributed to the logged-in account; people who leave keep knowing it until the next
change. Mitigations kept: per-member lockout, admin unlock, regular changes, change notice.

## Decisions (user)
- The club PIN **replaces** personal PINs. No PIN step in onboarding, no personal PIN form.
- 5 wrong tries lock **only that member** (as today), until an admin unlocks them.
- On a change, privileged members get a notification + e-mail **"Der Vereins-PIN wurde geändert"** —
  never the PIN itself. Security mails cannot be turned off (as today).
- Step-ups granted before a change stay valid until they expire (10 min); not ended on change.
- Face ID / fingerprint (device key step-up) stays unchanged.

## Decisions (mine, flagged to the user)
- **Who changes it:** ADMIN or BOARD (not coaches, although coaches use it).
- **First PIN:** while no club PIN exists, ADMIN or BOARD may set it without a step-up; every later change
  needs a step-up (current club PIN or device key). Until it exists, PIN step-up answers
  `auth.club-pin-not-set`; the client tells admin/board to set it and others to ask for it.
- **Reset all PINs** is removed (endpoint, dialog, confirmation setting). The per-member admin reset now
  means: unlock + remove that member's device keys and step-ups (no PIN to delete any more).
- PIN format and hashing unchanged: 5 characters `[0-9A-Za-z]`, not too simple (`PinHasher`), PBKDF2 over
  HMAC with `CLUB_SERVER_PIN_PEPPER`.

## Server (members module)
- Flyway (next free version, `db/migration/members`): table `club.members_club_pin` — single row
  (`id smallint PRIMARY KEY CHECK (id = 1)`, `pin_hash`, `salt`, `updated_at`, `updated_by` → members_member,
  ON DELETE SET NULL), RLS on. `members_pin` loses `pin_hash`/`salt` and becomes the per-member lock
  (`failed_attempts`, `locked`, `updated_at`); rename to `members_pin_lock`. Existing personal hashes are dropped.
- `SecurityRepository`: `findClubPin()`, `saveClubPin(hash, salt, by, at)`, attempts per member
  (`recordFailure`, `resetFailures`, `isLocked`); `resetAll(memberId)` keeps removing devices/step-ups/challenges
  and clears the lock; `resetEveryone` removed.
- `SecurityHandlers`: `checkPin` verifies against the club PIN with the member's own counter
  (`auth.club-pin-not-set` / `auth.pin-locked` / `auth.pin-wrong`, `PIN_LOCKED` on the 5th). New command
  `SET_CLUB_PIN(actor, newPin)`: ADMIN/BOARD; step-up required once a club PIN exists; publishes per active
  privileged member (except the changer) `SecurityChanged(memberId, CLUB_PIN_CHANGED)`. `resolveActor` no longer
  requires a PIN (`profile.pin-required` and `GET /me` missing `"pin"` removed). `SET_PIN`, `RESET_ALL_SECURITY`
  and `SecurityChange.PIN_SET/PIN_CHANGED` removed.
- `SecurityStatus` → `(clubPinSet, clubPinChangedAt, pinLocked, stepUpUntil, devices)`.
- REST: `PUT /api/v1/club/pin` `{ "pin": "…" }` (ADMIN/BOARD) replaces `PUT /me/pin`; `POST /members/security/reset-all` removed.
- Notifications: title "Der Vereins-PIN wurde geändert", body "Frag beim Vorstand nach dem neuen PIN. Wusstest du
  nichts davon? Melde dich beim Vorstand." (single-line title rule kept).
- Tests: `PostgresIT` seeds the club PIN `SEEDED_PIN` once per reset; `StepUpIT` rewritten (first PIN without
  step-up, change needs step-up and notifies, coach cannot change, per-member lock + admin unlock, device key);
  `NotificationsIT` reset mail adjusted. CLAUDE.md step-up paragraph updated.

## Client
- Remove the onboarding PIN step (`MissingProfileField 'pin'`), `SessionStore.setPin`, the personal PIN form.
- Einstellungen > Sicherheit: ADMIN/BOARD see "Vereins-PIN ändern" (new PIN twice, step-up before the change if
  one exists), plus "zuletzt geändert am …". Everyone sees whether they are locked. If no club PIN exists:
  admin/board are asked to set it; others see "Noch kein Vereins-PIN – frag den Vorstand."
- PinDialog text: "Vereins-PIN"; error text for `auth.club-pin-not-set`.
- Member window: admin reset becomes "Sperre aufheben und Geräte entfernen". Reset-all dialog, API, setting removed.
- Mock: one club PIN `73915` (README unchanged), per-member attempts; same rules as the server. Tests updated.

## Left to the builder
Exact migration number, class/method names, where the club-PIN form sits within SecuritySection, test details.
