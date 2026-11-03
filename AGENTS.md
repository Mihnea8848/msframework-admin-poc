# AGENTS.md

How to get MSFramework Admin running, how it is put together, and the rules for changing it (including the git workflow). This is written for both people and coding agents. The feature overview is in `README.md`.

## What runs where

| Piece | Tech | Port | Started by |
|---|---|---|---|
| Database | PostgreSQL 16 in Docker (`docker-compose.yml`, with a healthcheck) | host **5433** → container 5432 | `docker compose up -d --wait` |
| Backend | Spring Boot 4.0.3 (Spring 7, Security 7, Hibernate 7), Maven wrapper (`backend/`) | **8080** | `./mvnw spring-boot:run` |
| Frontend | React 19 + Vite 7, TypeScript 5 (migrating from JS) (`frontend/`) | **5173** | `npm run dev` |

The browser only talks to Vite. Vite proxies `/api/*` to `http://localhost:8080` (`frontend/vite.config.js`), so the session cookie stays same-origin and no CORS setup is needed. Always open `http://localhost:5173`, never `:8080` directly.

## Prerequisites

- **Docker** with Compose v2. Your user must be able to reach the Docker socket. If `docker ps` says `permission denied ... docker.sock`, run `sudo usermod -aG docker "$USER"` and log out and back in.
- **JDK 21 or newer.** Tested on JDK 21 (what CI uses) and JDK 27. The project compiles with `--release 21`. Lombok is pinned to 1.18.48 in `backend/pom.xml` because the version Boot ships (1.18.42) crashes `javac` on JDK 25+ with `ExceptionInInitializerError ... EndPosTable`.
- **Node.js 20.19+ or 22+** with npm (Vite 7's requirement; CI uses 22).

## Running it

### Option A: one command

```bash
./scripts/dev-run.sh
```

What the script does:
1. Checks Docker access, Compose v2, the Java version (21+) and npm, and stops with a clear message if anything is missing.
2. Refuses to start if 8080 or 5173 is already taken, or if 5433 is held by something other than this project's database. It never kills other processes.
3. Starts Postgres with `docker compose up -d --wait`, or reuses it if it's already running.
4. Runs `npm ci` if `frontend/node_modules` is missing.
5. Starts the backend, waits until it answers, then starts Vite.

`Ctrl+C` stops the backend and frontend. Postgres keeps running; stop it with `docker compose stop`.

### Option B: manually, in three terminals

This is easier to debug, and it's what agents should use.

```bash
docker compose up -d --wait                 # 1. database (healthy when this returns)
(cd backend && ./mvnw spring-boot:run)      # 2. backend: ready at "Started BackendApplication"
(cd frontend && npm ci && npm run dev)      # 3. frontend: prints Local and Network URLs
```

### Log in

Open http://localhost:5173 and sign in as `admin@test.com` / `password123`. This account is seeded only when the users table is empty. Accounts created through **Register** get the `MEMBER` role.

### Configuration (environment variables)

| Variable | Default | Purpose |
|---|---|---|
| `DB_URL` / `DB_USERNAME` / `DB_PASSWORD` | `jdbc:postgresql://localhost:5433/msframework`, `msframework`, `msframework` | Database connection |
| `SERVER_PORT` | `8080` | Backend port (Vite's proxy expects 8080) |
| `FRONTEND_URL` | `http://localhost:5173` | Base URL used in password-reset links |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | `admin@test.com` / `password123` | First admin account, created on an empty database only |
| `SHOW_SQL` | `false` | Log Hibernate SQL |

## Roles and permissions

The roles are defined in `backend/.../config/SystemRoles.java`, which is the single source of truth. On every start-up the seeder resets the built-in roles to match it.

| Role | Can do |
|---|---|
| ADMIN | Everything |
| MANAGER | Dashboard; read users and departments; edit **their own department** and the MEMBER/VIEWER users in it; audit log; timezones; docs |
| MEMBER | Dashboard; read users and departments; timezones; docs |
| VIEWER | Dashboard; docs |

Everyone can use **Account & security** (their own email and password) and **Appearance**.

Additional rules, enforced in `UserService`:
- At least one active admin must always exist.
- You cannot delete or deactivate yourself.
- Deactivating a user ends their session on their next request.

## Data, seeding and migrations

- **Flyway owns the schema.** Migrations live in `backend/src/main/resources/db/migration` and run on every start, before anything else touches the database. Hibernate only checks that the entities match (`ddl-auto=validate`); it never creates or changes tables.
  - `V1__baseline.sql` is the schema of a fresh install. It was generated from what Hibernate created for the entities, and keeps Hibernate's constraint names (`uk...`, `fk...`).
  - `V2__converge_legacy_schema.sql` brings databases created before Flyway in line with V1 (see below). It changes nothing on a fresh database.
- **To change the schema**, add a new file `V3__short_description.sql` (next free number, two underscores), change the entity to match, and run `./mvnw verify`: the app refuses to start if the entities and the tables disagree, and `MigrationTests` checks the migrations. Never edit a migration that has been applied anywhere: Flyway validates checksums and stops at start-up if one changed.
- **Databases from before Flyway** (created by `ddl-auto=update`, with no `flyway_schema_history` table) are handled by `config/FlywayConfig.java`:
  - if the tables look like an MSFramework schema (`users` and `departments` exist, and every table is one the app has created), it baselines the database at version 1 and runs V2, which adds missing tables, columns and constraints, fills a missing `status`/`created_at`, moves the legacy `users.role` value into `user_roles` (unknown values become MEMBER) and drops the old column. The log says `[FLYWAY] Found an MSFramework database from before Flyway ...`;
  - any other non-empty database stops the start-up with "The database is not empty and does not look like an MSFramework schema". Nothing is baselined blindly.
  - This changes the old database in place, so **back it up first**: `pg_dump -h localhost -p 5433 -U msframework msframework > backup.sql`.
- `DatabaseSeeder` is idempotent and runs on every start, after the migrations, under a PostgreSQL advisory lock (so several instances can start at once). It:
  - syncs role permissions;
  - seeds departments, the admin and the integrations only when their tables are empty.
- **Password reset doesn't send email yet.** The link is written to the backend log (`Password reset link for ...`). Tokens are stored hashed in `password_reset_tokens`, are single-use, last 30 minutes and survive restarts.
- To wipe everything and start fresh: `docker compose down -v`. This deletes all local data.
- Connect to the database directly: `psql -h localhost -p 5433 -U msframework msframework` (password `msframework`).

## Tests and checks (same as CI)

```bash
(cd frontend && npm ci && npm run lint && npm test && npm run build)
(cd backend && ./mvnw clean verify)
```

Frontend scripts (in `frontend/`):

| Script | What it does |
|---|---|
| `npm run lint` | ESLint (JS, JSX and TS), then Stylelint (`npm run lint:css`) |
| `npm test` | Vitest unit tests, once (`npm run test:watch` re-runs on save) |
| `npm run typecheck` | `tsc -b` on its own |
| `npm run build` | `tsc -b` type check, then `vite build` |

- Frontend unit tests are `*.test.ts` files next to the module they test (`src/utils/csv.test.ts`). They run in jsdom with Testing Library and jest-dom matchers (`src/test/setup.ts`). Mock `fetch` with `vi.stubGlobal`; never call the real backend from a unit test.
- `eslint-plugin-jsx-a11y` reports its recommended rules as **warnings** for now, because the existing pages have legacy issues. Don't add new ones; a later cleanup PR turns them into errors.
- Stylelint (`stylelint.config.mjs`, `stylelint-config-standard`) skips the legacy `src/styles/theme.css`, `src/index.css` and `src/App.css`. Any new CSS file is linted.

- Backend tests (`backend/src/test`) are MockMvc integration tests that go through the real security filter chain, on **real PostgreSQL 16**.
  - By default Testcontainers starts a `postgres:16` container. This needs Docker access (see Prerequisites); the first run pulls the image.
  - Without Docker, point the tests at any PostgreSQL 16 database they may wipe:
    ```bash
    TEST_DB_URL=jdbc:postgresql://localhost:5433/msframework_test ./mvnw verify
    ```
    `TEST_DB_USERNAME` and `TEST_DB_PASSWORD` default to `msframework`. The tests build the schema with the real Flyway migrations, and run Flyway `clean` first so a database left over from an earlier run starts empty. That wipes everything in it, so never use your dev database. `clean` is allowed only in the test profile (`spring.flyway.clean-disabled=false` in `application-test.properties`, strategy in `TestcontainersConfiguration`); it stays disabled in the app.
  - `MigrationTests` creates and drops extra databases (`msf_mig_*`) on the same server, so the test user needs the `CREATEDB` right. It loads the legacy fixtures in `src/test/resources/db/legacy` (a pre-RBAC database from commit `371775c`, the same database after it was started by the last pre-Flyway `main`, and a database created by that `main`), migrates them, and requires the same columns, constraints and indexes as a database migrated from empty.
- Every test class is annotated `@IntegrationTest` (`IntegrationTest.java`), so they all share one Spring context and one container. Don't add `@SpringBootTest` directly, or you'll start a second context and database.
- When you change behaviour, add or adjust a test in `ApiIntegrationTests`. Use unique emails and names, because the tests share one database.
- ESLint runs the React Compiler rules (`eslint-plugin-react-hooks` v7). Two common failures:
  - calling `setState` synchronously inside `useEffect` (do it in a promise or callback instead);
  - calling `Date.now()` during render.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `ExceptionInInitializerError ... EndPosTable` while compiling | Lombok older than 1.18.48 on a new JDK. Keep the `lombok.version` property in `pom.xml`. |
| `permission denied ... docker.sock` | Add your user to the `docker` group and log in again. |
| `Port 5433 is used by another program` | A local PostgreSQL is running. Stop it, or change the port in `docker-compose.yml` and set `DB_URL`. |
| Backend fails with `The connection attempt failed` / `SocketTimeoutException: Read timed out`, or dev-run says *healthy inside Docker but not reachable* | A VPN is routing Docker's bridge network away. `ip route get <container IP>` shows e.g. `dev tailscale0`. With a Tailscale exit node: `sudo tailscale set --exit-node-allow-lan-access=true` (keeps the exit node), or turn the exit node off. |
| `Port 8080/5173 is already in use` | An old backend or frontend is still running. Find it with `ss -ltnp` and stop it. |
| UI says "The backend is not reachable" | The backend isn't running or failed at start-up. Check its console. |
| Login works but pages show "permission" errors | That's expected for limited roles. Check the user's role on the User management page. |
| `docker compose up` complains about the name `msframework_db` | A container with that name exists from another checkout: `docker rm -f msframework_db` (the data volume is kept). |
| Start-up fails with "does not look like an MSFramework schema" | `DB_URL` points at a database that has other tables and no Flyway history. Use an empty database, or this app's own database. |
| Start-up fails with `Schema-validation: missing column` (or table) | An entity changed without a migration. Add a `V<n>__...sql` that makes the same change. |
| Start-up fails with `Validate failed: Migrations have failed validation` / checksum mismatch | An applied migration file was edited. Restore it and put the change in a new migration. |

## Git workflow

The full rules are in `.claude/skills/git-workflow/SKILL.md`; read it before any commit, push, pull request, merge or tag. In short:

- Never commit to `main`. Branch from an up-to-date `main`, open a pull request, wait for both CI checks ("Build Frontend (React)" and "Build & Test Backend (Spring Boot)"), then squash merge and delete the branch.
- Commit as the configured git identity, with GPG-signed commits, pushed over SSH. If signing fails, stop and ask; never commit unsigned.
- No AI attribution anywhere: no `Co-Authored-By` lines or "Generated with" footers in commits, pull requests, comments or tags.
- Commit subjects are imperative and at most about 60 characters, followed by a body that says what changed and why. No emojis, em dashes or `feat:`-style prefixes.
- Pull request bodies have a "What changed" list and a "Testing" checklist (`.github/pull_request_template.md`); tick only what was actually run.
- Update `README.md`, `AGENTS.md` and the "Unreleased" section of `CHANGELOG.md` in the same pull request as the change.
- Repository settings back this up: squash merges only, branches deleted after merge, and rulesets that protect `main` (pull requests only, both checks required, linear history, no force push or deletion) and `v*` tags. Repository admins can bypass them. If a CI job is renamed, update the ruleset's check names too.

## Architecture notes for agents

```
backend/src/main/java/com/msframework/backend/
  config/      SecurityConfig (session auth, public routes), SystemRoles, Permission, Integrations,
               FlywayConfig (guarded baseline), DatabaseSeeder
resources/db/migration/  Flyway migrations V1, V2, ... (the only place the schema changes)
  controller/  REST controllers under /api/* (thin: authorize, then delegate)
  service/     CurrentUserService (who is calling + permission checks), UserService (validation + rules),
               PasswordResetService, ImportService, AuditService, AuthSessionService, DatabaseInfoService
  dto/         records for every request/response. Entities are never serialized.
  exception/   ApiException(status, message) + GlobalExceptionHandler -> {"status","error","message"}
frontend/src/
  api/client.ts        the only place that calls fetch(); typed get<T>/post<T>/...; throws ApiError(status, message, data)
  api/types.ts         hand-written types mirroring the backend DTOs (keep in sync with backend dto/)
  auth/                AuthProvider (user, login, logout, sessionExpired), auth.ts API calls, permissions.ts helpers
  routes/navigation.ts every page with its path, icon and required permission (router, sidebar and palette use it)
  ui/                  Modal, Toggle, PageHeader, QuickActions
  utils/               validators.ts (mirrors backend rules), csv.ts, format.ts, storage.ts, auditTypes.ts, auditSeen.ts
  test/setup.ts        Vitest setup (jest-dom matchers, Testing Library cleanup)
  **/*.test.ts         unit tests, next to the module they cover
```

TypeScript migration:
- `tsconfig.json` is `strict` with `noUncheckedIndexedAccess`, and `allowJs` so `.ts` and `.jsx` files import each other. `checkJs` is off, so `.jsx` files are not type checked yet.
- **Write new code in TypeScript** (`.ts`, or `.tsx` for components). Shared modules are already converted; each page and component converts to `.tsx` when it is restyled. `allowJs` is dropped once the last one is converted.
- Import without a file extension (`"../api/client"`). Use `import type` for types (`verbatimModuleSyntax` is on).
- Response types come from `api/types.ts`, for example `get<UserDto[]>("/api/users")`. The type parameter is not checked at run time, so update `types.ts` in the same PR as a DTO change.

Conventions:
- **Authorization lives in the backend.** Start each endpoint with `currentUserService.requirePermission(principal, Permission.X)`. Frontend checks only hide UI.
- **Errors:** throw `ApiException.badRequest/forbidden/notFound/conflict("human message")`. The frontend shows `err.message` as-is, so write the message for an end user.
- **Audit:** call `auditService.log(type, actorEmail, description)` in every mutating endpoint. Add new types to `frontend/src/utils/auditTypes.ts` so they get a label, icon and filter category.
- **New permission:** add it to `Permission.java`, then to the roles in `SystemRoles.java` (the seeder applies it on the next start), and to the `Permission` type in `frontend/src/api/types.ts`. No migration is needed: the database deliberately has no CHECK listing permission names. Gate the UI with `hasPermission(user, "NAME")` and, for a page, add `permission` in `routes/navigation.ts`.
- **New page:** add an entry to `routes/navigation.ts` (and its key to `PageKey`) and a component to the `COMPONENTS` map in `routes/AppRoutes.jsx`.
- **API calls:** use `get`/`post`/`put`/`patch`/`del` from `api/client.ts` with relative `/api/...` paths. Don't call `fetch` directly.
- **Validation rules** exist in two places: backend `UserService` / `DepartmentRules` and frontend `utils/validators.ts`. Keep them in sync, and cover a changed rule in `utils/validators.test.ts`.
- Pages labelled as demo or sample data (Payments, department performance and budget, MFA, SSO) are intentionally not backed by real services. Keep them clearly labelled until they are.
