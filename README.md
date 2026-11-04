# MSFramework Dashboard

![CI Pipeline](https://img.shields.io/badge/build-passing-brightgreen?style=flat-square)
![React](https://img.shields.io/badge/React-19-blue?style=flat-square&logo=react)
![Spring Boot](https://img.shields.io/badge/Spring_Boot-4.0-success?style=flat-square&logo=spring-boot)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql)

A modern, full-stack company administration dashboard. Centralizes user management, department structure, integrations, security monitoring, and audit logging in a single interface — replacing the usual patchwork of disconnected SaaS tools.

> **Setting up a machine?** See [`AGENTS.md`](AGENTS.md) for the full setup guide, troubleshooting and conventions.

---

## Features

### Frontend (15 pages)

| Page | Route | Description |
|---|---|---|
| Sign in, Register, Forgot / Reset password | `/login`, `/register`, `/forgot-password`, `/reset-password` | Split layout from the Chevron concept: the form on the left, the grain-and-gradient logo on the right (hidden on phones). The logo outline is traced once on the first sign-in screen; moving between these pages fades the form in and leaves the art in place |
| Home | `/` | A card for every section your role can open, with live counts (a count that could not be loaded says so) |
| Dashboard | `/dashboard` | "Is everything working?": System status cards for the API, database, integrations and security score (live checks, with a summary line and *Refresh status*), Studio at a glance figures (users, active, admins, departments), the 8 latest audit events and quick links. Cards the role may not read say "Not checked" |
| User Management | `/users` | Search, create, edit (role / status / department / phone) and delete users |
| Departments | `/departments` | Create, rename, re-seal and delete departments; each card shows its seal and live member count, plus performance and budget figures labelled as sample data |
| Notifications | `/notifications` | Live audit log (auto-refresh every 15 s, unread badge in the sidebar and phone bar, category filters) |
| Appearance | `/appearance` | Dark, light or system theme; 6 brand accents (cyan, cobalt, violet, jade, gold, silver); comfortable or compact density; full or reduced motion (defaults to the device setting); live token preview. Saved per browser |
| Database | `/database` | Live schema, row counts and sizes of every application table |
| Documentation | `/docs` | In-app guide in collapsible sections with jump links, including the role/permission matrix |
| Account & security | `/auth` | Change your own email (password-confirmed) and password; MFA / SSO marked as coming soon |
| Security | `/security` | Security score and checks computed from live data + recent security events |
| Payments | `/payments` | Proof-of-concept view: balance, spending chart, transactions and a simulated Quick Pay, all labelled as sample data or demo (no payment provider connected) |
| Import Data | `/import` | CSV upload with preview; rows are validated and created by the backend, errors reported per row |
| Export Data | `/export` | Column-selectable UTF-8 CSV of users, departments or the audit log |
| Connections | `/connections` | Integrations (12 services), webhooks and API keys — all DB-persisted |
| Timezones | `/timezones` | Live world clocks and org default timezone, saved organisation-wide |

**Cross-cutting UI features:**
- Every page, sidebar entry and button is shown only to roles that may use it (the backend enforces the same rules)
- Quick Actions palette (⌘K / Ctrl+K or `/`): search and jump to any page you have access to with the arrow keys and Enter; Escape closes it and returns focus
- Clear error messages from the server everywhere (no silent failures)
- Persistent theme, accent, density and motion, restored before the first paint (no flash of the wrong theme)
- Chevron visual identity (Multimedia Entertainment Hub) on every page: Manrope and Montserrat, self-hosted; clipped-corner buttons and cards; department seals; colours from design tokens, checked for WCAG AA contrast in tests
- App shell mounted once (the sidebar, top bar and unread-notifications poll survive navigation): full sidebar from 1024 px, an icon rail from 768 px, and on phones a bottom tab bar (the first four pages your role may open) with a More sheet for the rest; no horizontal scrolling at 360 px
- Every page is a lazy-loaded chunk, prefetched on hover or focus and when the browser is idle; a bundle size budget fails the build when it grows
- Short fade-and-rise page transitions (View Transitions API where supported), all off with reduced motion; a logo-trace splash while the session loads
- Skip link to the main content, visible focus everywhere, 44 px touch targets on phones

### Backend (REST API)

| Controller | Endpoints |
|---|---|
| `AuthController` | `POST /api/auth/login`, `GET /me`, `POST /register`, `POST /logout`, `POST /email`, `POST /password`, `POST /forgot-password`, `POST /reset-password` |
| `UserController` | `GET`, `GET /search` (paged, filtered, sorted), `GET /{id}`, `GET /{id}/activity`, `POST`, `POST /bulk`, `POST /{id}/password-reset`, `PUT /{id}`, `DELETE /{id}` under `/api/users` |
| `DepartmentController` | `GET`, `GET /{id}` (with members), `GET /{id}/activity`, `POST`, `PUT /{id}`, `PUT /{id}/manager`, `POST` and `DELETE /{id}/members/{userId}`, `DELETE /{id}` under `/api/departments` |
| `AccessRequestController` | `GET /api/access-requests?status=`, `POST /{id}/approve`, `POST /{id}/reject` |
| `RoleController` | `GET /api/roles` (permissions and member counts) |
| `AuditController` | `GET /api/audit?limit=`, `POST /api/audit/event` (export events only) |
| `ConnectionsController` | `GET /api/connections`, `POST /{id}/connect`, `POST /{id}/disconnect`, `PATCH /{id}/toggle` |
| `WebhookController` | `GET /api/webhooks`, `POST`, `DELETE /{id}`, `PATCH /{id}/toggle` |
| `ApiKeyController` | `GET /api/keys`, `POST` (returns the secret once), `DELETE /{id}` |
| `OrgSettingController` | `GET /api/settings/{key}`, `PUT /api/settings/{key}` (`orgTimezone`, `worldClocks`) |
| `ImportController` | `POST /api/import/users`, `POST /api/import/departments` |
| `DatabaseController` | `GET /api/database/tables` |

- **Role-based access control:** ADMIN, MANAGER, MEMBER and VIEWER roles, permission-checked on every endpoint. Managers can only edit their own department and its members. The system always keeps one active admin.
- **People management:** paged user search, user profiles with an activity feed, bulk activate, deactivate, role and department changes (every rule checked per user), department managers, and admin-made password reset links (shown once, until email exists).
- **Access requests:** registering no longer creates an account. It sends a request that an admin approves (choosing the role and department) or rejects; until then, signing in says the request is still waiting.
- **Audit logging** on every mutating action, including failed and blocked sign-ins.
- **Security:** BCrypt passwords, session cookies (`HttpOnly`, `SameSite=Lax`), session-id rotation on login, password hashes never leave the server, API keys and reset tokens stored only as SHA-256 hashes, deactivated users lose access immediately.
- **OpenAPI contract:** the backend serves its OpenAPI 3.1 description at `/v3/api-docs` (springdoc; switched off in production with `API_DOCS_ENABLED=false`), and a copy is committed as [`api/openapi.json`](api/openapi.json). A test fails when the two drift apart; see [`AGENTS.md`](AGENTS.md) (API contract) for how to regenerate it.
- **Consistent JSON errors:** `{"status": 409, "error": "Conflict", "message": "…"}` with the correct HTTP status.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 7, React Router 7, Lucide Icons, TypeScript 5 |
| Styling | Plain CSS in cascade layers with design tokens (CSS custom properties, no framework); theme, accent, density and motion via `data-*` attributes on `<html>`; Manrope and Montserrat self-hosted with Fontsource (OFL-1.1) |
| Backend | Java 21+, Spring Boot 4.0, Spring Security 7, Spring Data JPA, Lombok |
| Database | PostgreSQL 16 (Docker); schema managed by Flyway migrations |
| Tests | Frontend: Vitest + Testing Library unit tests (jsdom). Backend: JUnit 5 + MockMvc integration tests on PostgreSQL 16 via Testcontainers |
| Code quality | ESLint (typescript-eslint, React Compiler rules, jsx-a11y), Stylelint, `tsc` type check |
| DevOps | Docker Compose, GitHub Actions CI (frontend lint + unit tests + type check + build, backend build + tests) |

---

## Getting Started

**Prerequisites:** Docker with Compose v2 (your user in the `docker` group), JDK 21 or newer, Node.js 20.19+ or 22+.

```bash
git clone https://github.com/Mihnea8848/msframework-admin-poc.git
cd msframework-admin-poc
./scripts/dev-run.sh
```

The script checks the prerequisites, then starts:
1. PostgreSQL in Docker on port **5433** (waits until healthy)
2. The Spring Boot backend on port **8080**
3. The Vite dev server on port **5173** (proxies `/api` → `localhost:8080`)

`Ctrl+C` stops the backend and frontend; the database keeps running (`docker compose stop` stops it).

Open **http://localhost:5173** and sign in with the seeded admin account:

| Field | Value |
|---|---|
| Email | `admin@test.com` |
| Password | `password123` |

The first start also adds **demo people** for MEH Studios (about 45 users in the seven departments, five department managers, access requests and 60 days of audit history). Every demo user, for example `radu.constantinescu@mehstudios.net` (MANAGER of Development) or `andreea.popescu@mehstudios.net` (ADMIN), signs in with the password **`MehDemo!2026`**. Set `SEED_DEMO_DATA=false` to start without them.

Manual start, configuration, tests and troubleshooting: [`AGENTS.md`](AGENTS.md).

### LAN access

The Vite server listens on `0.0.0.0`, so the terminal also prints a **Network** URL (e.g. `http://192.168.x.x:5173`) usable from other devices on the same network.

---

## Contributing

Every change goes through a pull request that passes CI and is squash merged; `main` is protected. See the Git workflow section of [`AGENTS.md`](AGENTS.md) and record user-visible changes in [`CHANGELOG.md`](CHANGELOG.md).

---

## Project Structure

```
msframework-admin-poc/
├── scripts/dev-run.sh          # One-command dev environment startup
├── docker-compose.yml          # PostgreSQL 16 on port 5433
├── frontend/
│   ├── scripts/check-bundle.mjs  # bundle size budget, run by npm run build
│   └── src/
│       ├── app/                # App, data router (router.tsx, routes.tsx), guards, lazy page loaders, splash, transitions
│       ├── api/client.ts       # fetch wrapper: JSON, error messages, 401 handling
│       ├── api/types.ts        # TypeScript types for the backend's JSON responses
│       ├── auth/               # AuthProvider, auth API calls, permission helpers
│       ├── pages/              # 15 page components (.tsx, each with its own .css); auth/ (AuthLayout + sign-in pages), dashboard/
│       ├── routes/             # navigation.ts (single page/permission registry, bottom bar order)
│       ├── shell/              # AppShell, Sidebar (and rail), Topbar, BottomNav, MoreSheet
│       ├── styles/             # index.css entry: tokens/ (colours, seals, scale, motion), base/
│       ├── theme/              # appearance preferences (theme, accent, density, motion)
│       ├── ui/                 # Button, Alert, PageHeader, Dialog, Toggle, QuickActions, seal/, brand/; field, surface and list CSS
│       ├── test/setup.ts       # Vitest setup (unit tests live next to their modules as *.test.ts)
│       └── utils/              # validators, CSV parse/export, formatting, audit event types
└── backend/
    └── src/
        ├── main/java/com/msframework/backend/
        │   ├── config/         # SecurityConfig, FlywayConfig, DatabaseSeeder, Permission, SystemRoles, Integrations
        │   ├── controller/     # 10 REST controllers
        │   ├── dto/            # Request/response records (no entity is ever serialized directly)
        │   ├── entity/         # JPA entities
        │   ├── exception/      # ApiException + GlobalExceptionHandler
        │   ├── repository/     # Spring Data repositories
        │   └── service/        # Users, password reset, import, audit, sessions, DB metadata
        ├── main/resources/db/migration/  # Flyway migrations (V1 baseline, V2 legacy upgrade, ...)
        └── test/               # Integration tests (PostgreSQL via Testcontainers)
```

---

## Database

The schema is created and changed by **Flyway** migrations in `backend/src/main/resources/db/migration`, which run on every start-up. Hibernate only checks that the tables match the entities.

- A new, empty database gets the whole schema from `V1__baseline.sql`.
- A database created by an older version of the app (before Flyway) is detected and upgraded in place: it is baselined at version 1 and `V2__converge_legacy_schema.sql` adds what is missing and moves old roles from the legacy `users.role` column into the role tables. **Back it up first** with `pg_dump`.
- A non-empty database that is not an MSFramework database is refused, and the app does not start.
- `V3__people.sql` adds department managers, job titles, last sign-in times, access requests and the indexes for user search. It stops with a clear message if two users have the same email in different capitals; merge or rename them first.

After the migrations, `DatabaseSeeder`:

- **syncs the permissions** of the four built-in roles with `SystemRoles.java`
- seeds **7 departments** (each with its own seal), the **admin user** and **12 service connections** when those tables are empty

Then, unless `SEED_DEMO_DATA=false`, `DemoPeopleSeeder` adds the demo people once (password `MehDemo!2026`). It adds to existing data, matches departments by name and never changes the admin account.

---

## Roadmap

- [x] Scaffold React frontend & Spring Boot backend
- [x] Wire up PostgreSQL via Docker Compose
- [x] Session-based auth (login, register, logout)
- [x] GitHub Actions CI pipeline (lint + build + tests)
- [x] Full CRUD for Users and Departments
- [x] Complete all 15 dashboard pages
- [x] Persistent light/dark theme, accent colors, compact density
- [x] Chevron brand tokens, self-hosted fonts, SVG logo, reduced-motion setting
- [x] ⌘K Quick Actions command palette
- [x] Live audit log with unread badge
- [x] Connections: integrations, webhooks, API keys — all DB-persisted
- [x] Organisation timezone and world clocks persisted in DB
- [x] Email and password change endpoints
- [x] Password reset (DB-backed single-use tokens)
- [x] Granular RBAC with manager/department scoping, enforced on every endpoint
- [x] Real CSV import with per-row validation
- [x] Backend integration test suite
- [ ] Email delivery (reset links are printed to the backend log for now)
- [ ] Real webhook delivery
- [ ] API-key authentication for the REST API
- [ ] MFA (two-factor authentication)
- [x] Versioned schema migrations (Flyway) instead of `ddl-auto=update`
