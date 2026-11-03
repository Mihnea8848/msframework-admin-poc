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
- Stylelint for new frontend CSS, and `eslint-plugin-jsx-a11y` (warnings
  for now) and `typescript-eslint` in the frontend lint.
- Chevron design foundation: colour, seal, spacing, type, density and
  motion tokens in `frontend/src/styles/tokens/`, layered CSS
  (`styles/index.css`), a contrast test that fails CI when a text pair
  drops below 4.5:1 (3:1 for focus rings and borders), and the approved
  concept in `design/concept-chevron.html`.
- Appearance: System theme, six brand accents, and a Full/Reduced motion
  setting that defaults to the device setting.
- SVG logo and favicon.
- Dashboard System status: API, database, integrations and security score
  cards from live checks (request latency, paused integrations, the
  Security page's checks), a one-line summary, "Checked X ago" and a
  *Refresh status* button. Anything the role may not read is shown as
  "Not checked" instead of a number.

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
  the backend DTOs, and `npm run build` type checks first. Pages stay
  JavaScript until they are restyled.
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
