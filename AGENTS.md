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
| `API_DOCS_ENABLED` | `true` | Serve the OpenAPI description at `/v3/api-docs` without login. Set it to `false` in production |

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
- Stylelint (`stylelint.config.mjs`, `stylelint-config-standard`) lints every CSS file except the legacy stylesheet in `src/styles/legacy/`. It rejects colour literals (hex, `rgb()`, `hsl()`, named colours) everywhere except `src/styles/tokens/primitives.css`, and requires the `ms-` prefix on class names (see "Frontend styles and design tokens").
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
- When you change behaviour, add or adjust a test in `ApiIntegrationTests`. Use unique emails and names, because the tests share one database.
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
  index.css            the only CSS entry (imported once in main.jsx); declares the layers and imports the rest
  tokens/primitives.css    the raw palette, the only file with colour literals
  tokens/semantic-dark.css colour roles for dark (the default); semantic-light.css overrides them
  tokens/accents.css       the 6 accent keys, per theme
  tokens/seals.css         the 8 department seals, per theme
  tokens/scale.css         spacing (4px grid), radii and clip shapes, fonts, type scale, control heights, z-index
  tokens/density.css       [data-density="compact"] overrides
  tokens/motion.css        durations and easings; all 0 under [data-motion="reduced"]
  tokens/legacy-aliases.css the old variables (--bg, --panel, --accent, ...) mapped to the new tokens
  base/                reset.css, fonts.css (self-hosted @font-face), typography.css
  legacy/              the pre-Chevron stylesheet, kept working through the aliases until pages are rebuilt
```

- **Cascade layers**, lowest priority first: `legacy, reset, tokens, base, components, shell, pages, utilities`. A later layer always wins, whatever the specificity, so `legacy/` can never override new styles. Because `reset` and `base` sit above `legacy`, keep them minimal and never set there something the legacy CSS relies on.
- **Hex only in primitives.** `primitives.css` names colours by what they are (`--brand-cyan`, `--charcoal-850`). Everything else uses **semantic tokens** by role: `--canvas`, `--surface-1` to `--surface-3`, `--field`, `--text-primary/secondary/tertiary/disabled`, `--border-faint/subtle/strong/control`, `--focus-ring`, `--primary`, `--primary-hover`, `--on-primary`, `--danger-solid`, `--on-danger`, and `--status-ok|warn|danger|info-fg/bg/border`. To add a colour, add a primitive, point a semantic token at it in both theme files, and add the pair to `contrast.test.ts` if it carries text or a boundary.
- **Accents** (`data-accent`): `cyan` (default), `cobalt`, `violet`, `jade`, `gold`, `silver`. The selected one fills `--accent-solid`, `--on-accent`, `--accent-text`, `--accent-line` and `--accent-tint`. Maple red (`--danger-solid`) is only for destructive actions and is never an accent.
- **Seals** (department colours): put `data-seal="administration|development|quality-control|external-affairs|human-resources|ethics-regulations|engineering-innovation|director"` on an element and use `--seal` (ring, glyph and fill), `--seal-fg` (content on a solid seal fill), `--seal-text` (seal-coloured text) and `--seal-border` inside it. The per-theme values live on `:root` as `--seal-<name>-*`. The current departments still store the older `avatar-*` keys (flat colours in `primitives.css`) until they move to seals.
- **Shape and type:** corners are 0 to 2px (`--radius-2`); the Chevron clipped corner is `clip-path: var(--clip-8)` (controls) or `var(--clip-12)` (panels). A clipped element also clips its focus outline, so drop the clip on `:focus-visible` or put the ring on a wrapper. Manrope (`--font-ui`) is the running text; Montserrat 600/700 uppercase (`--font-cap`) is for labels, buttons and eyebrows.
- **Class names:** new component classes are global BEM classes with the `ms-` prefix (`ms-logo`, `ms-logo__upper`), one CSS file per component next to it, wrapped in `@layer components { ... }`.
- **`<html>` attributes**, set before the first paint by `public/theme-init.js` (a blocking `<script src>` in `index.html`, not inline, so a strict CSP works) and changed live by `src/theme/appearance.ts`:
  - `data-theme`: `dark` or `light`. The stored preference (`theme` in localStorage) can also be `system`, resolved with `matchMedia`; dark is the default.
  - `data-accent` (stored as `accentKey`), `data-density` (`comfortable` or `compact`) and `data-motion` (`full` or `reduced`; the stored `motion` choice, otherwise the OS setting).
  - The script also migrates the old `accent`/`accentLabel` keys to `accentKey` and deletes them. It never sets inline styles: those would beat the tokens. Keep `theme-init.js` and `appearance.ts` in sync (`src/theme/themeInit.test.ts` runs the script).
- **Fonts** are self-hosted from `@fontsource-variable/manrope` and `@fontsource/montserrat` (SIL Open Font License 1.1), latin and latin-ext subsets only, declared in `base/fonts.css`. Don't add Google Fonts or other third-party font URLs.
- **Logo:** `src/ui/brand/Logo.tsx` is the two-path SVG mark, coloured by `--logo-upper` and `--logo-lower`; pass `title` when it is the only name on screen. The favicon is `public/favicon.svg`.
- **Login art:** `src/ui/brand/LogoArt.tsx` is the large decorative mark behind the sign-in pages: the `Logo.tsx` paths with brand gradients, an alpha mask that fades it toward the form, and an `feTurbulence` grain clipped to the mark. Its ids come from `useId`, it is `aria-hidden`, and the grain follows `--grain-blend`, `--grain-strength` and `--grain-wash` (per theme, in the semantic token files).
- **Shared controls:** `ui/Button.tsx` (`variant` primary, secondary, ghost or danger; the `<button>` shows the focus ring, the inner face is clipped), `ui/Alert.tsx` (ok, info, warn, danger), and CSS-only blocks you import from the component that uses them: `ui/field.css` (`ms-field`, `ms-field__label`, `ms-field__row`, `ms-input`, `ms-select`, `ms-field__error`, `ms-link`) and `ui/surface.css` (`ms-cut` clipped card, `ms-panel`, `ms-tag`).
- **Page header:** `ui/PageHeader.tsx` takes `eyebrow`, `title`, `count`, `description` and `actions`, and draws the three-segment stripe (`stripe={false}` hides it; the colours are `--stripe-1` to `--stripe-3`). The older `breadcrumb` ("Group / Page", whose first part becomes the eyebrow) and `subtitle` still work. On phones the eyebrow and stripe are hidden.
- **Auth pages** live in `src/pages/auth/`. Each page renders `<AuthLayout>` (pass `trace` on Login) with its title, lead and form inside, using the `ms-auth__title`, `ms-auth__lead`, `ms-auth__form` and `ms-auth__alt` classes. The layout keeps the art in one DOM node that moves from page to page, so it is never remounted even though the router renders each auth page separately; only the panel content fades in (`--duration-base`, 6px rise). The logo trace plays once per tab, on the first Login, and is skipped under `[data-motion="reduced"]`. Don't wrap the auth routes in `AuthLayout` in the router as well.
- **Dashboard** lives in `src/pages/dashboard/`. `status.ts` holds the pure functions that turn the API results into the status cards, the summary line and the figures (tested in `status.test.ts`); the security score comes from `utils/securityChecks.ts`, shared with the Security page. Never show a number the API did not give: a card the role may not read says "Not checked".
- **Brand names:** the product is MSFramework; in UI text the company is "Multimedia Entertainment Hub" ("MEH Studios Inc" in the narrow sidebar label). Example addresses use the `mehstudios.net` domain.

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
               FlywayConfig (guarded baseline), DatabaseSeeder, OpenApiConfig (title, server, error responses)
resources/db/migration/  Flyway migrations V1, V2, ... (the only place the schema changes)
  controller/  REST controllers under /api/* (thin: authorize, then delegate)
  service/     CurrentUserService (who is calling + permission checks), UserService (validation + rules),
               PasswordResetService, ImportService, AuditService, AuthSessionService, DatabaseInfoService
  dto/         records for every request/response (request bodies are never a Map). Entities are never serialized.
  exception/   ApiException(status, message) + GlobalExceptionHandler -> {"status","error","message"}
api/openapi.json       the committed API contract, regenerated with -Dopenapi.write=true (see API contract)
frontend/src/
  api/client.ts        the only place that calls fetch(); typed get<T>/post<T>/...; throws ApiError(status, message, data)
  api/types.ts         hand-written types mirroring the backend DTOs (keep in sync with backend dto/)
  auth/                AuthProvider (user, login, logout, sessionExpired), auth.ts API calls, permissions.ts helpers,
                       useAuthContext.ts (typed access to the context from .tsx until AuthProvider is converted)
  routes/navigation.ts every page with its path, icon and required permission (router, sidebar and palette use it)
  styles/              index.css (the only CSS entry), tokens/, base/, legacy/ (see "Frontend styles and design tokens")
  theme/appearance.ts  appearance preferences; public/theme-init.js applies them before the first paint
  pages/auth/          AuthLayout (split layout, shared art, motion) + Login, Register, ForgotPassword, ResetPassword
  pages/dashboard/     Dashboard.tsx + status.ts (status cards, summary, figures)
  ui/                  Button, Alert, PageHeader, Modal, Toggle, QuickActions, field.css, surface.css,
                       brand/Logo.tsx, brand/LogoArt.tsx
  utils/               validators.ts (mirrors backend rules), csv.ts, format.ts, storage.ts, auditTypes.ts, auditSeen.ts,
                       securityChecks.ts (Security page and Dashboard)
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
- **Request bodies** are records in `dto/` named after what they carry (`ChangePasswordRequest`), never `Map<String, ...>`, so the contract describes them. Keep field names stable: the frontend sends them as-is.
- **API changes** go with a regenerated `api/openapi.json` in the same pull request.
- **API calls:** use `get`/`post`/`put`/`patch`/`del` from `api/client.ts` with relative `/api/...` paths. Don't call `fetch` directly.
- **Validation rules** exist in two places: backend `UserService` / `DepartmentRules` and frontend `utils/validators.ts`. Keep them in sync, and cover a changed rule in `utils/validators.test.ts`.
- Pages labelled as demo or sample data (Payments, department performance and budget, MFA, SSO) are intentionally not backed by real services. Keep them clearly labelled until they are.
