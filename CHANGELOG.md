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
- Stylelint for new frontend CSS, and `eslint-plugin-jsx-a11y` (warnings
  for now) and `typescript-eslint` in the frontend lint.

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
