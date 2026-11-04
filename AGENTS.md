# AGENTS.md

How to get MSFramework Admin running, how it is put together, and the rules for changing it (including the git workflow). This is written for both people and coding agents. The feature overview is in `README.md`.

## What runs where

| Piece | Tech | Port | Started by |
|---|---|---|---|
| Database | PostgreSQL 16 in Docker (`docker-compose.yml`, with a healthcheck) | host **5433** → container 5432 | `docker compose up -d --wait` |
| Backend | Spring Boot 4.0.3 (Spring 7, Security 7, Hibernate 7), Maven wrapper (`backend/`) | **8080** | `./mvnw spring-boot:run` |
| Frontend | React 19 + Vite 7, TypeScript 5 (`frontend/`) | **5173** | `npm run dev` |

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

Open http://localhost:5173 and sign in as `admin@test.com` / `password123`. This account is seeded only when the users table is empty.

**Register** does not create an account: it creates an access request (`access_requests`) that an admin approves (with a role and department; the account gets the password chosen when registering) or rejects. Signing in before approval answers 403 "Your access request is still waiting for approval", but only when the password matches the request.

**Demo users** (`DemoPeopleSeeder`, while `SEED_DEMO_DATA` is on): about 45 people `first.last@mehstudios.net` across the seven departments, all with the password **`MehDemo!2026`**. Useful ones: `andreea.popescu@` (ADMIN), `radu.constantinescu@` (MANAGER and manager of Development), `kenji.watanabe@` (MEMBER), `ioana.stan@` (VIEWER).

### Configuration (environment variables)

| Variable | Default | Purpose |
|---|---|---|
| `DB_URL` / `DB_USERNAME` / `DB_PASSWORD` | `jdbc:postgresql://localhost:5433/msframework`, `msframework`, `msframework` | Database connection |
| `SERVER_PORT` | `8080` | Backend port (Vite's proxy expects 8080) |
| `FRONTEND_URL` | `http://localhost:5173` | Base URL used in password-reset links |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | `admin@test.com` / `password123` | First admin account, created on an empty database only |
| `SHOW_SQL` | `false` | Log Hibernate SQL |
| `API_DOCS_ENABLED` | `true` | Serve the OpenAPI description at `/v3/api-docs` without login. Set it to `false` in production |
| `SEED_DEMO_DATA` | `true` (`false` in tests) | Property `app.seed.demo`: add the demo data once (`DemoPeopleSeeder`, ...). Set it to `false` in production |
| `FINANCE_CURRENCY` | `EUR` | The organisation's one ISO 4217 currency. Nothing is converted, so set it before any money is recorded |
| `INGEST_REQUESTS_PER_MINUTE` | `60` | Requests per API key per minute on `POST /api/ingest/checkins` (in memory, per instance) |

## Roles and permissions

The roles are defined in `backend/.../config/SystemRoles.java`, which is the single source of truth. On every start-up the seeder resets the built-in roles to match it.

| Role | Can do |
|---|---|
| ADMIN | Everything |
| MANAGER | Dashboard; read users and departments; edit **their own department** and the MEMBER/VIEWER users in it (including bulk changes and reset links for them); audit log and activity feeds; roles overview; timezones; docs |
| MEMBER | Dashboard; read users and departments; timezones; docs |
| VIEWER | Dashboard; docs |

Everyone can open **Settings** (`/settings/:tab`): their own profile, email and password, their appearance, and a read-only view of the organisation settings.

Additional rules, enforced in `UserService`:
- At least one active admin must always exist.
- You cannot delete or deactivate yourself.
- Deactivating a user ends their session on their next request.
- Bulk actions (`POST /api/users/bulk`) run each user through the same `UserService.update`, one transaction per user, and return one result per id.

People endpoints and what they need:

| Endpoint | Permission and scope |
|---|---|
| `GET /api/users/search`, `GET /api/users/{id}` | USER_READ |
| `GET /api/users/{id}/activity`, `GET /api/departments/{id}/activity` | USER_READ or DEPARTMENT_READ, plus AUDIT_READ |
| `POST /api/users/bulk`, `POST /api/users/{id}/password-reset` | USER_UPDATE, with the manager scope per user |
| `GET /api/departments/{id}` | DEPARTMENT_READ and USER_READ |
| `PUT /api/departments/{id}/manager` | DEPARTMENT_UPDATE and the ADMIN role. The manager must be an active member of the department with the MANAGER or ADMIN role; it is cleared when they leave, are deactivated, lose the role or are deleted |
| `POST`/`DELETE /api/departments/{id}/members/{userId}` | USER_UPDATE; goes through `UserService.update`, so managers cannot move people between departments |
| `GET /api/access-requests`, `POST .../approve`, `POST .../reject` | ACCESS_REQUESTS_MANAGE (ADMIN) |
| `GET /api/roles` | ROLES_READ (ADMIN, MANAGER) |
| `GET /api/departments` | Public; the manager fields are null for anonymous callers |

### Business permissions (budgets, expenses, goals, reports)

| Permission | ADMIN | MANAGER | MEMBER | VIEWER |
|---|---|---|---|---|
| `FINANCE_READ` (budgets, every expense, payments) | yes | yes | | |
| `FINANCE_MANAGE` (budgets, categories, approve any, mark paid, expense/budget import) | yes | | | |
| `EXPENSE_SUBMIT` | any department | own department | own department | |
| `EXPENSE_APPROVE` | any department | own department | | |
| `GOALS_READ` (goals, performance; check-ins for your own department) | yes | yes | yes | yes |
| `GOALS_MANAGE` (goal CRUD) | any department | own department | | |
| `REPORTS_READ` (overview, budget and performance CSV) | yes | yes | | yes |

The "own department" scoping is enforced in `service/BusinessAccess.java`, not by the permission:
- FINANCE_MANAGE works everywhere; EXPENSE_APPROVE alone only for the approver's department.
- Nobody approves or rejects their own expense, admins included.
- GOALS_MANAGE is org-wide for the ADMIN role and own-department otherwise.
- Check-ins: members of the goal's department, its managers, and admins.
- Without FINANCE_READ you see your own expenses (approvers also their department's).
- The expense CSV export needs FINANCE_READ as well as REPORTS_READ.

## Data, seeding and migrations

- **Flyway owns the schema.** Migrations live in `backend/src/main/resources/db/migration` and run on every start, before anything else touches the database. Hibernate only checks that the entities match (`ddl-auto=validate`); it never creates or changes tables.
  - `V1__baseline.sql` is the schema of a fresh install. It was generated from what Hibernate created for the entities, and keeps Hibernate's constraint names (`uk...`, `fk...`).
  - `V2__converge_legacy_schema.sql` brings databases created before Flyway in line with V1 (see below). It changes nothing on a fresh database.
  - `V3__people.sql`: `users.title`, `users.last_login_at`, `departments.manager_id` (`ON DELETE SET NULL`), `audit_events.subject_user_id`/`subject_department_id` (no foreign keys, so history outlives deletions), the `access_requests` table, a unique index on `lower(email)` (with a preflight that stops with a list of the duplicate addresses) and indexes for search and the activity feeds.
- **To change the schema**, add a new file `V3__short_description.sql` (next free number, two underscores), change the entity to match, and run `./mvnw verify`: the app refuses to start if the entities and the tables disagree, and `MigrationTests` checks the migrations. Never edit a migration that has been applied anywhere: Flyway validates checksums and stops at start-up if one changed.
- **Databases from before Flyway** (created by `ddl-auto=update`, with no `flyway_schema_history` table) are handled by `config/FlywayConfig.java`:
  - if the tables look like an MSFramework schema (`users` and `departments` exist, and every table is one the app has created), it baselines the database at version 1 and runs V2, which adds missing tables, columns and constraints, fills a missing `status`/`created_at`, moves the legacy `users.role` value into `user_roles` (unknown values become MEMBER) and drops the old column. The log says `[FLYWAY] Found an MSFramework database from before Flyway ...`;
  - any other non-empty database stops the start-up with "The database is not empty and does not look like an MSFramework schema". Nothing is baselined blindly.
  - This changes the old database in place, so **back it up first**: `pg_dump -h localhost -p 5433 -U msframework msframework > backup.sql`.
- `DatabaseSeeder` is idempotent and runs on every start, after the migrations, under a PostgreSQL advisory lock (so several instances can start at once). It:
  - syncs role permissions;
  - seeds departments, the admin and the integrations only when their tables are empty.
- The demo seeders run after it (`DatabaseSeeder` is `@Order(0)`, `DemoPeopleSeeder` `@Order(100)`; later demo seeders use larger numbers), only when `app.seed.demo` is true, under the same advisory lock. Each writes a marker row in `org_settings` (`demo.people.v1`) and does nothing once it is there. They add to existing data: departments are matched by name, existing emails are skipped, and the admin account is never touched.
- `V5__business.sql` adds the business tables (`expense_categories` with 9 defaults, `budgets`, `expenses`, `goals`, `goal_checkins`) and `api_keys.scopes` (default empty, so existing keys keep doing what they did). Expenses, goals and check-ins point at users with `ON DELETE SET NULL` and keep a copy of the email, so deleting a user keeps the history. A department that has budgets, expenses or goals cannot be deleted (409).
- `DemoBusinessSeeder` (when `app.seed.demo` is true) runs on `ApplicationReadyEvent` with `@Order(200)`, so after every start-up runner including `DatabaseSeeder` and the demo people seeder, under the same advisory lock. It seeds once per database (marker `demo.business.v1` in `org_settings`): budgets, about 350 expenses and 2 to 3 goals per department with weekly check-ins for the current and the two previous quarters. Departments are matched by name (missing standard ones are created); submitters are the department's members (the admin when there are none) and approvers its MANAGER-role users or an admin.
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
| `npm run build` | `tsc -b` type check, `vite build`, then the bundle budget (`scripts/check-bundle.mjs`) |
| `npm run check:bundle` | The bundle budget on its own, against an existing `dist/`: gzip sizes of the entry JS (<= 130 kB), all CSS together, including each page's own stylesheet (<= 34 kB), each lazy chunk (<= 40 kB) and the latin `.woff2` fonts (<= 70 kB). Prints a table and fails when one is over |

- Frontend unit tests are `*.test.ts` (or `.test.tsx` for components) files next to the module they test (`src/utils/csv.test.ts`, `src/shell/MoreSheet.test.tsx`). Router tests build a `createMemoryRouter(routes)` from `src/app/routes.tsx` inside `AuthProvider` and assert on `router.state.location`. jsdom has no `HTMLDialogElement.showModal`, so dialogs must work with the `open` attribute too (see `shell/MoreSheet.tsx`). They run in jsdom with Testing Library and jest-dom matchers (`src/test/setup.ts`). Mock `fetch` with `vi.stubGlobal`; never call the real backend from a unit test.
- `eslint-plugin-jsx-a11y` runs its recommended rules as **errors**. If a rule is wrong for one element (an `option` in a combobox listbox, for example), disable it on that line with a comment that says why.
- Stylelint (`stylelint.config.mjs`, `stylelint-config-standard`) lints every CSS file under `src/`. It rejects colour literals (hex, `rgb()`, `hsl()`, named colours) everywhere except `src/styles/tokens/primitives.css`, and requires the `ms-` prefix on class names (see "Frontend styles and design tokens").
- `src/styles/tokens/contrast.test.ts` resolves the colour tokens for every theme x accent and theme x seal and fails when a pair drops below WCAG AA (4.5:1 for text, 3:1 for the focus ring, control borders and seal outlines). If you change a colour token and it fails, pick a different primitive; don't lower the threshold.

- Backend tests (`backend/src/test`) are MockMvc integration tests that go through the real security filter chain, on **real PostgreSQL 16**.
  - By default Testcontainers starts a `postgres:16` container. This needs Docker access (see Prerequisites); the first run pulls the image.
  - Without Docker, point the tests at any PostgreSQL 16 database they may wipe:
    ```bash
    TEST_DB_URL=jdbc:postgresql://localhost:5433/msframework_test ./mvnw verify
    ```
    `TEST_DB_USERNAME` and `TEST_DB_PASSWORD` default to `msframework`. The tests build the schema with the real Flyway migrations, and run Flyway `clean` first so a database left over from an earlier run starts empty. That wipes everything in it, so never use your dev database. `clean` is allowed only in the test profile (`spring.flyway.clean-disabled=false` in `application-test.properties`, strategy in `TestcontainersConfiguration`); it stays disabled in the app.
  - `MigrationTests` creates and drops extra databases (`msf_mig_*`) on the same server, so the test user needs the `CREATEDB` right. It loads the legacy fixtures in `src/test/resources/db/legacy` (a pre-RBAC database from commit `371775c`, the same database after it was started by the last pre-Flyway `main`, and a database created by that `main`), migrates them, and requires the same columns, constraints and indexes as a database migrated from empty.
- Every test class is annotated `@IntegrationTest` (`IntegrationTest.java`), so they all share one Spring context and one container. Don't add `@SpringBootTest` directly, or you'll start a second context and database.
- When you change behaviour, add or adjust a test in `ApiIntegrationTests` (people management lives in `PeopleApiTests`). Use unique emails and names, because the tests share one database.
- ESLint runs the React Compiler rules (`eslint-plugin-react-hooks` v7). Two common failures:
  - calling `setState` synchronously inside `useEffect` (do it in a promise or callback instead);
  - calling `Date.now()` during render.

## API contract (OpenAPI)

- The backend describes its API with springdoc-openapi (`springdoc-openapi-starter-webmvc-api`, no Swagger UI). The description is served at `GET /v3/api-docs` without login while `API_DOCS_ENABLED` is `true` (the default for dev and tests). Vite only proxies `/api`, so this is the one URL to fetch from the backend port: `curl http://localhost:8080/v3/api-docs`.
- A copy is committed as **`api/openapi.json`** at the repository root: pretty-printed, keys sorted, no timestamps, server URL pinned to `/`. The frontend will generate its types from it.
- `OpenApiContractTest` fetches `/v3/api-docs` during `./mvnw verify`, normalises it and fails when it differs from `api/openapi.json`, naming the first line that differs.
- **Rule: if you change the API, regenerate `api/openapi.json` in the same pull request** and review its diff:
  ```bash
  (cd backend && ./mvnw verify -Dopenapi.write=true)
  # quicker, only the contract test:
  (cd backend && ./mvnw test -Dtest=OpenApiContractTest -Dopenapi.write=true)
  ```
  `OPENAPI_WRITE=true` in the environment does the same. The test finds the repository root from its own class files, so it works whichever directory Maven runs from.
- Changes that alter the contract: an endpoint, a path or query parameter, a request or response DTO field, a `@Schema`/`@Operation`/`@Tag` annotation, or the project version in `pom.xml` (it is the `info.version`).
- How endpoints are documented: every controller has a `@Tag`, every endpoint an `@Operation` with an explicit `operationId` (names must stay unique and stable, because generated clients use them) and a `summary`. Endpoints that answer 201 or 204 declare it with `@ApiResponse`. `config/OpenApiConfig` adds the `ErrorResponse` body as the `4XX` and `5XX` response of every operation, so don't repeat it per endpoint.

## Business domain (budgets, expenses, goals, reports)

- **Money** is `numeric(14,2)` plus a currency code; the organisation has one currency (`FINANCE_CURRENCY`) and nothing is converted. Quarters follow the calendar year (`service/FiscalPeriods`).
- **Budgets:** one line per department, category and quarter. Spent = APPROVED + PAID expenses dated in the quarter, committed = SUBMITTED, remaining = budget − spent − committed (`service/SpendLedger` does the sums in SQL). `GET /api/budgets` also returns spending that has no budget line (id null, amount 0).
- **Expenses:** DRAFT → SUBMITTED → APPROVED → PAID, or SUBMITTED → REJECTED (a note is required). The submitter edits while DRAFT or SUBMITTED and deletes drafts. Submitting over the remaining budget is allowed and stored as `overBudget`. Each expense in a response carries `actions` (edit, submit, approve, reject, pay, delete) for the caller, so the UI does not repeat the rules. Every transition is audited.
- **Payments** are PAID expenses (`GET /api/payments`, by payment date, with monthly totals); `provider.connected` is always false: MSFramework records payments, it does not move money.
- **Goals:** a KPI per department and quarter with unit, direction, baseline, target, weight and owner. Attainment = progress from baseline to target in percent, clamped to 0..120 (`GoalService.attainment`); the department score is the weighted average attainment of its goals that have check-ins. Check-in dates must be inside the goal's quarter and not in the future. `GET /api/performance` adds a six-month trend (each month's score as of its last day).
- **Reports:** `GET /api/reports/overview` prorates each quarter's budget by the days inside the range; `GET /api/reports/export.csv` writes CSV straight to the response.
- **API-key ingest:** `config/IngestSecurityConfig` is a separate, stateless filter chain for `/api/ingest/**`, ordered before the session chain. It is CSRF-exempt (no cookie is used), authenticates `Authorization: Bearer <key>` in `ApiKeyAuthenticationFilter` (401 for a missing or unknown key), and needs the key's scope (403 without it). Scopes are granted when the key is created (`POST /api/keys` with `"scopes": ["ingest:checkins"]`). Ingests are audited (`checkins_ingested`) and rate-limited per key.

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
| `OpenApiContractTest` fails with "The API no longer matches api/openapi.json" | The API changed. If that was intended, regenerate the file (see API contract) and commit it with the change. |
| Start-up fails with "does not look like an MSFramework schema" | `DB_URL` points at a database that has other tables and no Flyway history. Use an empty database, or this app's own database. |
| Start-up fails with `Schema-validation: missing column` (or table) | An entity changed without a migration. Add a `V<n>__...sql` that makes the same change. |
| Start-up fails with `Validate failed: Migrations have failed validation` / checksum mismatch | An applied migration file was edited. Restore it and put the change in a new migration. |

## Frontend styles and design tokens

The approved visual design is **Concept C, Chevron**: `design/concept-chevron.html` (a self-contained prototype with sample data; open it in a browser). It is the reference for tokens, type, shapes and the login look; `design/README.md` lists what the client kept and rejected.

```
frontend/src/styles/
  index.css            the only CSS entry (imported once in main.tsx); declares the layers and imports the rest
  tokens/primitives.css    the raw palette, the only file with colour literals
  tokens/semantic-dark.css colour roles for dark (the default); semantic-light.css overrides them
  tokens/accents.css       the 6 accent keys, per theme
  tokens/seals.css         the 8 department seals, per theme
  tokens/scale.css         spacing (4px grid), radii and clip shapes, fonts, type scale, control heights, z-index
  tokens/density.css       [data-density="compact"] overrides
  tokens/motion.css        durations and easings; all 0 under [data-motion="reduced"]
  base/                reset.css (box sizing, link and button resets, form fonts, reduced motion), fonts.css
                       (self-hosted @font-face), typography.css
  utilities.css        single-purpose helpers (ms-visually-hidden)
```

Component, shell and page styles live next to their component (`src/ui/brand/logo.css`, `src/shell/sidebar.css`, `src/pages/payments.css`), imported by it. There is no global legacy stylesheet any more: every page uses `ms-` classes and tokens.

- **Cascade layers**, lowest priority first: `reset, tokens, base, components, shell, pages, utilities`. A later layer always wins, whatever the specificity. Keep `reset` and `base` small: components should not have to undo them.
- **Hex only in primitives.** `primitives.css` names colours by what they are (`--brand-cyan`, `--charcoal-850`). Everything else uses **semantic tokens** by role: `--canvas`, `--surface-1` to `--surface-3`, `--field`, `--text-primary/secondary/tertiary/disabled`, `--border-faint/subtle/strong/control`, `--focus-ring`, `--primary`, `--primary-hover`, `--on-primary`, `--danger-solid`, `--on-danger`, and `--status-ok|warn|danger|info-fg/bg/border`. To add a colour, add a primitive, point a semantic token at it in both theme files, and add the pair to `contrast.test.ts` if it carries text or a boundary.
- **Accents** (`data-accent`): `cobalt` (default), `cyan`, `violet`, `jade`, `gold`, `silver`. The selected one fills `--accent-solid`, `--on-accent`, `--accent-text`, `--accent-line` and `--accent-tint`. Maple red (`--danger-solid`) is only for destructive actions and is never an accent.
- **Seals** (department colours): put `data-seal="administration|development|quality-control|external-affairs|human-resources|ethics-regulations|engineering-innovation|director"` on an element and use `--seal` (ring, glyph and fill), `--seal-fg` (content on a solid seal fill), `--seal-text` (seal-coloured text) and `--seal-border` inside it. The per-theme values live on `:root` as `--seal-<name>-*`. Departments store a colour key (`avatar-*`, the backend accepts `avatar-[a-z]+`); `ui/seal/seals.ts` maps every key to a seal (`sealForColor`), and each seal has the key a new department saves. The seeder gives the seven default departments their own seal's key.
- **Official seals:** `ui/seal/OfficialSeal.tsx` (`seal`, `title`) is the full department seal redrawn from the brand artwork (`MEH Studios Branding & Logos.pdf`): the riveted dark disc, the title on a text path, the gear ring with its vents, the stars, "MEH Studios Incorporated" and an emblem per seal. It uses `--seal-official` (set by `data-seal`) and the `--seal-disc-*` tokens, which are the same in both themes because the printed seal is always dark. `sealRingTitle(name, seal)` gives the ring text: the department's own name when it is named after its seal, otherwise the seal's official title. It is `aria-hidden`; put the name in text next to it. Use it from about 96px up; below that (table rows, phone rows) use `SealMini`.
- **Shape and type:** corners are 0 to 2px (`--radius-2`); the Chevron clipped corner is `clip-path: var(--clip-8)` (controls) or `var(--clip-12)` (panels). A clipped element also clips its focus outline, so drop the clip on `:focus-visible` or put the ring on a wrapper. Manrope (`--font-ui`) is the running text; Montserrat 600/700 uppercase (`--font-cap`) is for labels, buttons and eyebrows.
- **Class names:** new component classes are global BEM classes with the `ms-` prefix (`ms-logo`, `ms-logo__upper`), one CSS file per component next to it, wrapped in `@layer components { ... }` (`@layer shell { ... }` for `src/shell/` and `src/app/`).
- **`<html>` attributes**, set before the first paint by `public/theme-init.js` (a blocking `<script src>` in `index.html`, not inline, so a strict CSP works) and changed live by `src/theme/appearance.ts`:
  - `data-theme`: `dark` or `light`. The stored preference (`theme` in localStorage) can also be `system`, resolved with `matchMedia`; dark is the default.
  - `data-accent` (stored as `accentKey`), `data-density` (`comfortable` or `compact`) and `data-motion` (`full` or `reduced`; the stored `motion` choice, otherwise the OS setting).
  - The script also migrates the old `accent`/`accentLabel` keys to `accentKey` and deletes them. It never sets inline styles: those would beat the tokens. Keep `theme-init.js` and `appearance.ts` in sync (`src/theme/themeInit.test.ts` runs the script).
- **Fonts** are self-hosted from `@fontsource-variable/manrope` and `@fontsource/montserrat` (SIL Open Font License 1.1), latin and latin-ext subsets only, declared in `base/fonts.css`. Don't add Google Fonts or other third-party font URLs.
- **Logo:** `src/ui/brand/Logo.tsx` is the two-path SVG mark, coloured by `--logo-upper` and `--logo-lower`; pass `title` when it is the only name on screen. The favicon is `public/favicon.svg`.
- **Login art:** `src/ui/brand/LogoArt.tsx` fills the screen behind the sign-in pages from 25vw (under the form panel): a night sky (`--art-sky-*`, `--art-haze`), a fine star dust (thresholded `feTurbulence` used as a CSS mask), a tiled star pattern, a few twinkling stars, and a field of the `Logo.tsx` mark as extruded tiles (side walls computed from the path vertices, a blurred cyan rim) around a larger white core with a glow behind it. The tiles sit on a staggered lattice turned by `ANGLE` (24 degrees) with the marks, and the cell size (`CELL_W`, `CELL_H`) keeps every silhouette, walls and glow included, clear of its neighbours: tiles must never overlap. A veil in `--canvas` keeps it all hidden up to 40% of the viewport and fades it in (smoothstep) by about 72%, so the start of the art and the tile edges are never seen. Colours are the `--art-*` tokens, with a pale variant in light mode. Motion is transforms and opacity only (the dust and stars drift in seamless 90 s loops, stars twinkle, the core's glow pulses, the cluster floats 4px), and every animation uses `steps()` so the compositor only draws a frame when something moved: keep it that way, smooth timing costs a whole core in software rendering. It runs only under `prefers-reduced-motion: no-preference` and `data-motion="full"`. Ids come from `useId`, and it is `aria-hidden`.
- **Shared controls:** `ui/Button.tsx` (`variant` primary, secondary, ghost, ghost-danger (an outlined Delete on a row or card) or danger (the solid confirm button); the `<button>` shows the focus ring, the inner face is clipped), `ui/Alert.tsx` (ok, info, warn, danger), `ui/Toggle.tsx` (a `role="switch"` button), `ui/Dialog.tsx` (a native modal `<dialog>`, a bottom sheet below 768px; put `DialogBody` and `DialogFooter` inside, `size="sm"` and `tone="danger"` for confirmations; Escape, the backdrop and the close button call `onClose` unless `busy`, and focus returns to the trigger), `ui/seal/Seal.tsx` (`SealMini`), `ui/seal/OfficialSeal.tsx` (see above), `ui/useReveal.ts` and `ui/CountUp.tsx` (see Motion below), and CSS-only blocks you import from the component that uses them: `ui/field.css` (`ms-field`, `ms-field__label`, `ms-field__row`, `ms-input`, `ms-select`, `ms-field__error`, `ms-link`), `ui/surface.css` (`ms-cut` clipped card, `ms-panel` with `ms-panel__head`/`__title`, `ms-tag`) and `ui/list.css` (`ms-toolbar`, `ms-search`, `ms-chip`, `ms-table-wrap` + `ms-table`, `ms-status` pills with an icon, `ms-role`, `ms-empty`, `ms-notice`).
- **Quick Actions:** `ui/QuickActions.tsx` is a native `<dialog>` near the top of the screen, mounted only while open, with a combobox (`aria-activedescendant`) over a grouped listbox of the pages the user may open. Arrow keys move, Enter opens, Escape or the backdrop closes, and focus returns to where it was. `QuickActions.test.tsx` covers it.
- **Pages:** each page is one `.tsx` file in `src/pages/` with its own stylesheet next to it (`ms-<page>` block, `@layer pages`), built from the shared controls above. A page whose root is a grid uses `grid-template-columns: minmax(0, 1fr)`, or the one-line phone header description widens the column past 360px. Sample data (Payments, department performance and budget) carries an `ms-tag` saying "Sample data" or "Demo".
- **Page header:** `ui/PageHeader.tsx` takes `eyebrow`, `title`, `count`, `description` and `actions`, and draws the three-segment stripe (`stripe={false}` hides it; the colours are `--stripe-1` to `--stripe-3`). The older `breadcrumb` ("Group / Page", whose first part becomes the eyebrow) and `subtitle` still work. On phones the eyebrow and stripe are hidden.
- **Auth pages** live in `src/pages/auth/`. Each page renders `<AuthLayout>` (pass `trace` on Login) with its title, lead and form inside, using the `ms-auth__title`, `ms-auth__lead`, `ms-auth__form` and `ms-auth__alt` classes. The layout keeps the art in one DOM node that moves from page to page, so it is never remounted even though the router renders each auth page separately; only the panel content fades in (`--duration-base`, 6px rise). The logo trace plays once per tab, on the first Login, and is skipped under `[data-motion="reduced"]`. Don't wrap the auth routes in `AuthLayout` in the router as well.
- **Dashboard** lives in `src/pages/dashboard/`. `status.ts` holds the pure functions that turn the API results into the status cards, the summary line and the figures (tested in `status.test.ts`); the security score comes from `utils/securityChecks.ts`, shared with the Security page. Never show a number the API did not give: a card the role may not read says "Not checked".
- **Brand names:** the product is MSFramework; in UI text the company is "Multimedia Entertainment Hub" ("MEH Studios Inc" in the narrow sidebar label). Example addresses use the `mehstudios.net` domain.

### Shell, routing and motion

- **Data router:** `src/app/router.tsx` (`createBrowserRouter`) with the route table in `src/app/routes.tsx`, generated from `PAGES`. Auth pages (`/login`, `/register`, `/forgot-password`, `/reset-password`) sit outside the shell; every other page is a child of one layout route, `RequireAuth` + `shell/AppShell`. Settings is one route, `/settings/:tab?` (no tab or an unknown one opens Account), and the old paths in `LEGACY_PATHS` (`/notifications`, `/auth`, `/appearance`) redirect to their new homes. Guards: signed out goes to `/login` with `state.from`; signed in on `/login` or `/register` goes to `/`; a missing permission goes to `/`; unknown paths go to `/`.
- **The shell is mounted once.** Only the `<Outlet />` inside `<main>` changes on navigation, so anything that must survive navigation (the unread badge poll in `shell/useUnreadAudit.ts`, Quick Actions, the More sheet) belongs in `AppShell`, not in a page.
- **Breakpoints:** full sidebar from 1024px, a 64px icon rail (labels as tooltips, still the links' accessible names) from 768 to 1023px, and below 768px a 52px top bar plus `BottomNav` (the first `MOBILE_TAB_COUNT` = 4 permitted pages by `mobilePriority`, then More) and `MoreSheet` (a native modal `<dialog>`: Escape, backdrop and close button close it; focus returns to More). Layout sizes are tokens in `tokens/scale.css` (`--sidebar-width`, `--rail-width`, `--topbar-height`, `--bottom-nav-height`, `--touch-target`). The content column is centred, at most `--content-max` (1280px) wide, with the concept's padding; pages must not add their own outer padding and must not overflow 360px.
- **Lazy pages and prefetch:** each page is a chunk from `PAGE_LOADERS` (`app/pages.ts`). Shell links use `shell/PageLink.tsx`, which prefetches on hover, focus and touch; `AppShell` prefetches every permitted page one per idle period (`requestIdleCallback`, `setTimeout` fallback). The router loads a chunk before it commits the navigation, so no loading fallback is needed.
- **Sidebar groups** (`PAGE_GROUPS`): Overview, People, Performance, Finance, Operations, Security, Resources; a group without permitted pages is skipped. Settings is not in the sidebar: the top bar cog and the user chip open it, the phone More sheet has a Settings button next to Log out, and Quick Actions lists its tabs (`SETTINGS_TABS`). Its tabs are links with `role="tab"`: one Tab stop, and the arrow keys, Home and End move between tabs (and their URLs).
- **Page transitions:** a 180ms (`--duration-base`) fade with a 6px rise of `<main>` only. `PageLink` passes react-router's `viewTransition` when `data-motion="full"` and `document.startViewTransition` exists (checked at click time, `app/transitions.ts`); `<main>` is the only element with a `view-transition-name` (`page`), and the root snapshot is not animated (`shell/view-transitions.css`). Any navigation that did not run as a view transition replays the `ms-shell__main--enter` CSS animation instead. Reduced motion makes both instant. Moving between Settings tabs does not replay it. Never add wipe or slide transitions or a stripe band on the sidebar (rejected by the client).
- **Reveal, lift and count-up** (`ui/motion.css`): spread `useReveal(ready)(i, className)` on a page's top-level cards or rows for a staggered entrance (fade and 6px rise, 35 ms apart, capped at 8) the first time the page shows its data; after that it returns the plain class, so refreshes do not replay it. Add `ms-lift` to a clickable card for a 2px hover lift with an accent outline. `CountUp` counts a figure up once (600 ms). All three are still under reduced motion.
- **Splash:** `#ms-splash` in `index.html` is plain HTML (no inline script or style, so a strict CSP works) styled by `app/splash.css`, which is in the main stylesheet. `RootLayout` removes it once the first `/api/auth/me` has answered and the first page chunk is loaded. It shows the logo trace only after `--duration-fast`, and a still logo with reduced motion.
- **Keyboard:** the first Tab stop is the "Skip to main content" link (`#main`, which takes focus). Ctrl/Cmd+K or `/` (outside text fields) opens Quick Actions.

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
               FlywayConfig (guarded baseline), DatabaseSeeder, DemoPeopleSeeder, DemoBusinessSeeder,
               OpenApiConfig (title, server, error responses),
               IngestSecurityConfig + ApiKeyAuthenticationFilter (stateless API-key chain for /api/ingest/**),
               FinanceSettings (org currency)
resources/db/migration/  Flyway migrations V1, V2, ... (the only place the schema changes)
  controller/  REST controllers under /api/* (thin: authorize, then delegate)
  service/     CurrentUserService (who is calling + permission checks), UserService (validation + rules),
               UserBulkService, DepartmentService, AccessRequestService, PasswordResetService, ImportService,
               AuditService (+ activity feeds), AuthSessionService, DatabaseInfoService,
               BudgetService, ExpenseService, GoalService, ReportService, IngestService, SpendLedger (SQL sums),
               BusinessAccess (department scoping), FiscalPeriods, Money
  dto/         records for every request/response (request bodies are never a Map). Entities are never serialized.
  exception/   ApiException(status, message) + GlobalExceptionHandler -> {"status","error","message"}
api/openapi.json       the committed API contract, regenerated with -Dopenapi.write=true (see API contract)
frontend/src/
  main.tsx             entry: imports styles/index.css and renders app/App.tsx
  app/                 App.tsx (AuthProvider + RouterProvider), router.tsx (createBrowserRouter), routes.tsx (the route
                       table), guards.tsx (RequireAuth, RedirectIfAuthed, RequirePermission), pages.ts (lazy page
                       loaders + prefetch), RootLayout.tsx, splash.ts/.css, transitions.ts
  shell/               AppShell (the layout route, mounted once), Sidebar (+ rail), Topbar, BottomNav, MoreSheet,
                       PageLink (prefetch + view transition), useUnreadAudit (the badge poll)
  api/client.ts        the only place that calls fetch(); typed get<T>/post<T>/...; throws ApiError(status, message, data)
  api/types.ts         hand-written types mirroring the backend DTOs (keep in sync with backend dto/)
  auth/                AuthProvider (user, login, logout, sessionExpired), auth.ts API calls, permissions.ts helpers
  routes/navigation.ts every page with its path, icon, group, required permission and mobilePriority (router, sidebar,
                       bottom bar, More sheet and palette use it), the Settings tabs and the redirected old paths
  styles/              index.css (the only CSS entry), tokens/, base/ (see "Frontend styles and design tokens")
  theme/appearance.ts  appearance preferences; public/theme-init.js applies them before the first paint
  pages/auth/          AuthLayout (split layout, shared art, motion) + Login, Register, ForgotPassword, ResetPassword
  pages/dashboard/     Dashboard.tsx + status.ts (status cards, summary, figures)
  pages/settings/      Settings.tsx (the tab row and panel) + AccountTab, SecurityTab, AppearanceTab, OrganisationTab
  pages/               the other pages (HomePage, UserManagement, Departments, Notifications (Activity and Audit
                       log), DatabasePage, Connections, Timezones, Documentation, Security, Payments, ImportData,
                       ExportData), each .tsx with its own .css
  ui/                  Button, Alert, PageHeader, Dialog, Toggle, QuickActions, CountUp, useReveal (+ motion.css),
                       seal/ (Seal.tsx, OfficialSeal.tsx, seals.ts), brand/Logo.tsx, brand/LogoArt.tsx, and the CSS
                       blocks field.css, surface.css, list.css
  utils/               validators.ts (mirrors backend rules), csv.ts, format.ts, storage.ts, auditTypes.ts, auditSeen.ts,
                       securityChecks.ts (Security page and Dashboard)
  test/setup.ts        Vitest setup (jest-dom matchers, Testing Library cleanup)
  **/*.test.ts(x)      unit tests, next to the module they cover
frontend/scripts/check-bundle.mjs  the bundle size budget, run by npm run build
```

TypeScript:
- All of `src/` is TypeScript. `tsconfig.json` is `strict` with `noUncheckedIndexedAccess`, and has no `allowJs`: write `.ts`, or `.tsx` for components.
- Import without a file extension (`"../api/client"`). Use `import type` for types (`verbatimModuleSyntax` is on).
- Response types come from `api/types.ts`, for example `get<UserDto[]>("/api/users")`. The type parameter is not checked at run time, so update `types.ts` in the same PR as a DTO change.

Conventions:
- **Authorization lives in the backend.** Start each endpoint with `currentUserService.requirePermission(principal, Permission.X)`. Frontend checks only hide UI.
- **Errors:** throw `ApiException.badRequest/forbidden/notFound/conflict("human message")`. The frontend shows `err.message` as-is, so write the message for an end user.
- **Audit:** call `auditService.log(type, actorEmail, description)` in every mutating endpoint, or `log(..., AuditService.Subject)` when the event is about a user or department, so it shows in their activity feed (`/api/users/{id}/activity`, `/api/departments/{id}/activity`; keyset paged with an opaque `cursor`). Add new types to `frontend/src/utils/auditTypes.ts` so they get a label, icon and filter category.
- **New permission:** add it to `Permission.java`, then to the roles in `SystemRoles.java` (the seeder applies it on the next start), and to the `Permission` type in `frontend/src/api/types.ts`. No migration is needed: the database deliberately has no CHECK listing permission names. Gate the UI with `hasPermission(user, "NAME")` and, for a page, add `permission` in `routes/navigation.ts`.
- **New page:** add an entry to `routes/navigation.ts` in its sidebar group (and its key to `PageKey`; set `mobilePriority` if it should be able to appear in the phone bottom bar) and a loader to `PAGE_LOADERS` in `app/pages.ts` (`() => import("../pages/MyPage")`, default export). `app/routes.tsx` turns every entry into a lazy route inside the shell behind `RequirePermission`, and the sidebar, bottom bar, More sheet and Quick Actions pick it up. Keep each page chunk under the 40 kB budget; never import a page statically, or it lands in the entry bundle. A page outside the shell (like `/login`) is added to `app/routes.tsx` directly.
- **Request bodies** are records in `dto/` named after what they carry (`ChangePasswordRequest`), never `Map<String, ...>`, so the contract describes them. Keep field names stable: the frontend sends them as-is.
- **API changes** go with a regenerated `api/openapi.json` in the same pull request.
- **API calls:** use `get`/`post`/`put`/`patch`/`del` from `api/client.ts` with relative `/api/...` paths. Don't call `fetch` directly.
- **Validation rules** exist in two places: backend `UserService` / `DepartmentRules` and frontend `utils/validators.ts`. Keep them in sync, and cover a changed rule in `utils/validators.test.ts`.
- Pages labelled as demo or sample data (Payments, department performance and budget, MFA, SSO) are intentionally not backed by real services. Keep them clearly labelled until they are.
