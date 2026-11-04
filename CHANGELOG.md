# Changelog

All notable changes to this project are documented here. Versions follow
[SemVer](https://semver.org/). Add entries under "Unreleased" in the same
pull request as the change; a "Release vX.Y.Z" pull request turns that
section into a version (see `AGENTS.md`, Git workflow).

## Unreleased

### Security
- API responses no longer include password hashes; every endpoint checks
  permissions; session ids rotate on login; deactivated users lose their
  session immediately.
- API keys and password reset tokens are stored only as hashes.
- Sessions are stored in PostgreSQL (Spring Session JDBC) and survive
  restarts. They end after 30 minutes without activity (`SESSION_TIMEOUT`);
  background polls (`X-Background-Request: 1`) do not count. Deactivating
  or deleting a user, or resetting their password, ends all their sessions.
- CSRF protection with the `XSRF-TOKEN` cookie and `X-XSRF-TOKEN` header;
  the API client sends it and recovers from a stale token.
- Sign-in, password reset and registration are rate-limited per IP, and 5
  failed sign-ins lock an account for 15 minutes (429 with `Retry-After`),
  with database-backed counters. `TRUSTED_PROXY` controls whether
  `X-Forwarded-For` is used.
- BCrypt cost raised to 12; older hashes are upgraded at the next sign-in.
  New passwords may not be one of the 1000 most common passwords.

### Added (sessions and organisation)
- Sessions API: list and sign out your own sessions; admins
  (`SESSIONS_MANAGE`) can sign a user out everywhere.
- Organisation settings API (`/api/org/settings`, `ORG_SETTINGS_MANAGE`):
  company name, registration on or off, minimum password length, default
  timezone, and the session timeout (read-only). `GET
  /api/auth/registration` tells the sign-in page whether sign-up is open.

### Added
- Create and delete users, user search, and the missing status field.
- Real CSV import with per-row errors, live database schema page, real
  dashboard activity feed and security checks.
- Organisation-wide world clocks.
- Backend integration test suite (MockMvc), running on real PostgreSQL 16
  through Testcontainers, or on any PostgreSQL given in `TEST_DB_URL`.
- Contribution workflow: pull request template, changelog, repository
  rulesets for `main` and release tags.
- Frontend unit tests with Vitest and Testing Library (validators, CSV,
  formatting, permissions, storage and the API client), run by `npm test`
  and in CI.
- Migration tests that upgrade real legacy databases (pre-RBAC and the
  last pre-Flyway `main`) and compare them with a fresh database.
- OpenAPI description of the API at `/v3/api-docs` (springdoc-openapi 3.1.1, no
  Swagger UI), open without login unless `API_DOCS_ENABLED=false`. The
  committed contract `api/openapi.json` is checked by `OpenApiContractTest`;
  regenerate it with `./mvnw verify -Dopenapi.write=true`.
- Stylelint for the frontend CSS, and `eslint-plugin-jsx-a11y` and
  `typescript-eslint` in the frontend lint.
- Chevron design foundation: colour, seal, spacing, type, density and
  motion tokens in `frontend/src/styles/tokens/`, layered CSS
  (`styles/index.css`), a contrast test that fails CI when a text pair
  drops below 4.5:1 (3:1 for focus rings and borders), and the approved
  concept in `design/concept-chevron.html`.
- Appearance: System theme, six brand accents, and a Full/Reduced motion
  setting that defaults to the device setting.
- SVG logo and favicon.
- App shell in the Chevron design, mounted once for every signed-in page:
  sidebar with a Quick actions field (Ctrl K / Cmd K), the chevron marker on
  the current page and the "Multimedia Entertainment Hub" footer; an icon
  rail with tooltips from 768 to 1023 px; a top bar with back and forward,
  a "Group / Page" breadcrumb, the user's name and role, settings and Log
  out; and on phones a bottom tab bar (the first four pages the role may
  open, ordered by `mobilePriority` in `navigation.ts`) with a More sheet
  for the rest. A skip link jumps to the main content.
- Page transitions: a 180 ms fade and 6 px rise of the content only, with
  the View Transitions API where the browser has it and motion is on, a
  CSS animation otherwise, and nothing with reduced motion.
- A logo-trace splash (plain HTML and CSS in `index.html`) while the first
  session check runs.
- Bundle size budget (`frontend/scripts/check-bundle.mjs`, part of
  `npm run build`): entry JS 130 kB, all CSS 30 kB, each lazy chunk 40 kB
  and the latin fonts 70 kB, gzip.
- Dashboard System status: API, database, integrations and security score
  cards from live checks (request latency, paused integrations, the
  Security page's checks), a one-line summary, "Checked X ago" and a
  *Refresh status* button. Anything the role may not read is shown as
  "Not checked" instead of a number.
- `Dialog` (native modal `<dialog>`, a bottom sheet on phones), department
  seal components, shared list blocks (toolbar, table, status pills) and a
  `ghost-danger` Button variant for Delete on a row or card.

### Fixed
- Changing your own email no longer logs you out.
- Deleting a department with members unassigns them instead of failing.
- Export columns and CSV escaping; compact density; reset link survival
  across restarts; errors reported with the right HTTP status.

### Changed
- The database schema is managed by Flyway migrations instead of Hibernate
  `ddl-auto=update`; Hibernate now only validates it. Databases created by
  older versions are recognised, baselined and upgraded in place (legacy
  `users.role` values move into `user_roles`); any other non-empty
  database is refused at start-up. Back up old databases before upgrading.
- The start-up seeder runs under a PostgreSQL advisory lock, so several
  instances can start at the same time. Its legacy data repairs moved into
  the `V2` migration.
- MANAGER can no longer create departments and can now view timezones.
- Account & security and Appearance are available to every role.
- Backend builds on JDK 21 through 27 (Lombok 1.18.48).
- `dev-run.sh` checks prerequisites instead of killing processes.
- The frontend starts moving to TypeScript: the API client, auth helpers,
  navigation and utilities are typed `.ts` modules, `api/types.ts` mirrors
  the backend DTOs, and `npm run build` type checks first. The pages
  followed as they were restyled, so the whole frontend is TypeScript.
- Removed the unused `bootstrap` dependency.
- Request bodies that were untyped maps (change email or password, forgot
  and reset password, client audit events, API keys, webhooks, settings)
  are typed records. The JSON fields, defaults and error messages are
  unchanged.
- The existing pages use the Chevron palette and type through a bridge
  from the old colour variables: dark background `#171717`, no lime
  accent, no gradient buttons, glows, blur or heavy shadows. The auth pages
  lose the animated wave background. The brand reads "Multimedia
  Entertainment Hub", with "MEH Studios Inc" under MSFramework in the
  sidebar.
- Manrope and Montserrat are self-hosted instead of loaded from Google
  Fonts, so no visitor data goes to a third party.
- The frontend uses a react-router data router (`src/app/router.tsx`).
  Every page is its own lazy-loaded chunk, prefetched on hover or focus of
  its link and when the browser is idle. The sidebar and top bar no longer
  remount on every navigation, so the unread-notifications poll keeps
  running instead of restarting. New pages open scrolled to the top.
- Phones no longer scroll sideways: the old top bar and the dashboard
  cards overflowed a 390 px screen.
- Sign in, Register, Forgot password and Reset password are rebuilt on the
  Chevron split layout: the form on the left, the grain-and-gradient logo
  on the right (smaller than in the concept, fading toward the form, hidden
  on phones), and the audit notice under the form. The logo is traced once
  on the first sign-in screen; between these pages only the form fades in
  with a small rise, and nothing moves with reduced motion. Behaviour,
  validation and messages are unchanged.
- The Dashboard and the page header follow the concept: eyebrow, title,
  description, the three-segment stripe, clipped-corner cards and panels.
  The header keeps its old props, so the other pages pick it up as is.
- The Security page's checks moved to `utils/securityChecks.ts`, shared
  with the Dashboard, so both show the same score.
- The theme is applied before the first paint by `public/theme-init.js`
  instead of an inline script. Saved accents from the old palette move to
  the new accent keys (Lime and Rose become Cyan).
- Removed the 1.4 MB PNG logo and unused images.
- Every page is rebuilt on the Chevron design in TypeScript: Home, User
  management, Departments, Notifications, Appearance, Account & security,
  Security, Connections, Timezones, Database, Documentation, Import,
  Export and Payments. They use the shared components and their own
  `ms-` stylesheets, fit a 360 px screen without sideways scrolling, and
  keep their API calls, permissions, validation and messages. Payments
  and the department performance and budget figures are labelled as
  sample data.
- Departments show their seal (emblem and colour) instead of a flat
  colour; new installs seed each default department with its own seal.
- Quick Actions is a native dialog with a combobox and grouped list, and
  returns focus to where it was when it closes.
- Home tiles are links, and a count that could not be loaded says "Could
  not load" instead of 0.
- The legacy stylesheet, the old colour variable bridge, `Modal.jsx` and
  `allowJs` are gone; the jsx-a11y lint rules are errors again. The CSS
  budget is 30 kB, since it counts every page's own stylesheet.
