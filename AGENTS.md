# AGENTS.md

How to get MSFramework Admin running, how it is put together, and the rules for changing it (including the git workflow). This is written for both people and coding agents. The feature overview is in `README.md`.

## What runs where

| Piece | Tech | Port | Started by |
|---|---|---|---|
| Database | PostgreSQL 16 in Docker (`docker-compose.yml`, with a healthcheck) | host **5433** → container 5432 | `docker compose up -d --wait` |
| Backend | Spring Boot 4.0.3 (Spring 7, Security 7, Hibernate 7), Maven wrapper (`backend/`) | **8080** | `./mvnw spring-boot:run` |
| Frontend | React 19 + Vite 7 (`frontend/`) | **5173** | `npm run dev` |

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

- Hibernate maintains the schema (`ddl-auto=update`): it adds tables and columns but never drops or renames them.
- `DatabaseSeeder` is idempotent and runs on every start. It:
  - syncs role permissions;
  - seeds departments, the admin and the integrations only when their tables are empty;
  - gives roleless users from pre-RBAC databases a role from the old `users.role` column (or MEMBER);
  - sets a missing status to `Active`.
- **Password reset doesn't send email yet.** The link is written to the backend log (`Password reset link for ...`). Tokens are stored hashed in `password_reset_tokens`, are single-use, last 30 minutes and survive restarts.
- To wipe everything and start fresh: `docker compose down -v`. This deletes all local data.
- Connect to the database directly: `psql -h localhost -p 5433 -U msframework msframework` (password `msframework`).

## Tests and checks (same as CI)

```bash
(cd frontend && npm ci && npm run lint && npm run build)
(cd backend && ./mvnw clean verify)
```

- Backend tests (`backend/src/test`) are MockMvc integration tests that go through the real security filter chain, on **real PostgreSQL 16**.
  - By default Testcontainers starts a `postgres:16` container. This needs Docker access (see Prerequisites); the first run pulls the image.
  - Without Docker, point the tests at any PostgreSQL 16 database they may wipe:
    ```bash
    TEST_DB_URL=jdbc:postgresql://localhost:5433/msframework_test ./mvnw verify
    ```
    `TEST_DB_USERNAME` and `TEST_DB_PASSWORD` default to `msframework`. The schema is dropped and recreated, so never use your dev database.
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
  config/      SecurityConfig (session auth, public routes), SystemRoles, Permission, Integrations, DatabaseSeeder
  controller/  REST controllers under /api/* (thin: authorize, then delegate)
  service/     CurrentUserService (who is calling + permission checks), UserService (validation + rules),
               PasswordResetService, ImportService, AuditService, AuthSessionService, DatabaseInfoService
  dto/         records for every request/response. Entities are never serialized.
  exception/   ApiException(status, message) + GlobalExceptionHandler -> {"status","error","message"}
frontend/src/
  api/client.js        the only place that calls fetch(); throws ApiError with the server's message
  auth/                AuthProvider (user, login, logout, sessionExpired), permissions.js helpers
  routes/navigation.js every page with its path, icon and required permission (router, sidebar and palette use it)
  ui/                  Modal, Toggle, PageHeader, QuickActions
  utils/               validators.js (mirrors backend rules), csv.js, format.js, auditTypes.js
```

Conventions:
- **Authorization lives in the backend.** Start each endpoint with `currentUserService.requirePermission(principal, Permission.X)`. Frontend checks only hide UI.
- **Errors:** throw `ApiException.badRequest/forbidden/notFound/conflict("human message")`. The frontend shows `err.message` as-is, so write the message for an end user.
- **Audit:** call `auditService.log(type, actorEmail, description)` in every mutating endpoint. Add new types to `frontend/src/utils/auditTypes.js` so they get a label, icon and filter category.
- **New permission:** add it to `Permission.java`, then to the roles in `SystemRoles.java` (the seeder applies it on the next start). Gate the UI with `hasPermission(user, "NAME")` and, for a page, add `permission` in `routes/navigation.js`.
- **New page:** add an entry to `routes/navigation.js` and a component to the `COMPONENTS` map in `routes/AppRoutes.jsx`.
- **API calls:** use `get`/`post`/`put`/`patch`/`del` from `api/client.js` with relative `/api/...` paths. Don't call `fetch` directly.
- **Validation rules** exist in two places: backend `UserService` / `DepartmentRules` and frontend `utils/validators.js`. Keep them in sync.
- Pages labelled as demo or sample data (Payments, department performance and budget, MFA, SSO) are intentionally not backed by real services. Keep them clearly labelled until they are.
