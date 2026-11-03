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
| Home | `/` | Overview grid of every section your role can open, with live counts |
| Dashboard | `/dashboard` | KPI cards (users, active, admins, departments) + live recent-activity feed from the audit log |
| User Management | `/users` | Search, create, edit (role / status / department / phone) and delete users |
| Departments | `/departments` | Create, rename, recolor and delete departments with live member counts |
| Notifications | `/notifications` | Live audit log (auto-refresh every 15 s, unread badge in the sidebar, category filters) |
| Appearance | `/appearance` | Light/dark theme, 6 accent colors, comfortable/compact density — saved per browser |
| Database | `/database` | Live schema, row counts and sizes of every application table |
| Documentation | `/docs` | In-app guide, including the role/permission matrix |
| Account & security | `/auth` | Change your own email (password-confirmed) and password; MFA / SSO marked as coming soon |
| Security | `/security` | Security score and checks computed from live data + recent security events |
| Payments | `/payments` | Proof-of-concept view with sample data (no payment provider connected) |
| Import Data | `/import` | CSV upload with preview; rows are validated and created by the backend, errors reported per row |
| Export Data | `/export` | Column-selectable UTF-8 CSV of users, departments or the audit log |
| Connections | `/connections` | Integrations (12 services), webhooks and API keys — all DB-persisted |
| Timezones | `/timezones` | Live world clocks and org default timezone, saved organisation-wide |

**Cross-cutting UI features:**
- Every page, sidebar entry and button is shown only to roles that may use it (the backend enforces the same rules)
- Quick Actions palette (⌘K / Ctrl+K or `/`) — search and jump to any page you have access to
- Clear error messages from the server everywhere (no silent failures)
- Persistent light/dark theme with flash-free restore on page load
- Responsive layout with sidebar collapse on mobile

### Backend (REST API)

| Controller | Endpoints |
|---|---|
| `AuthController` | `POST /api/auth/login`, `GET /me`, `POST /register`, `POST /logout`, `POST /email`, `POST /password`, `POST /forgot-password`, `POST /reset-password` |
| `UserController` | `GET`, `POST`, `PUT /{id}`, `DELETE /{id}` under `/api/users` |
| `DepartmentController` | `GET`, `POST`, `PUT /{id}`, `DELETE /{id}` under `/api/departments` |
| `AuditController` | `GET /api/audit?limit=`, `POST /api/audit/event` (export events only) |
| `ConnectionsController` | `GET /api/connections`, `POST /{id}/connect`, `POST /{id}/disconnect`, `PATCH /{id}/toggle` |
| `WebhookController` | `GET /api/webhooks`, `POST`, `DELETE /{id}`, `PATCH /{id}/toggle` |
| `ApiKeyController` | `GET /api/keys`, `POST` (returns the secret once), `DELETE /{id}` |
| `OrgSettingController` | `GET /api/settings/{key}`, `PUT /api/settings/{key}` (`orgTimezone`, `worldClocks`) |
| `ImportController` | `POST /api/import/users`, `POST /api/import/departments` |
| `DatabaseController` | `GET /api/database/tables` |

- **Role-based access control:** ADMIN, MANAGER, MEMBER and VIEWER roles, permission-checked on every endpoint. Managers can only edit their own department and its members. The system always keeps one active admin.
- **Audit logging** on every mutating action, including failed and blocked sign-ins.
- **Security:** BCrypt passwords, session cookies (`HttpOnly`, `SameSite=Lax`), session-id rotation on login, password hashes never leave the server, API keys and reset tokens stored only as SHA-256 hashes, deactivated users lose access immediately.
- **Consistent JSON errors:** `{"status": 409, "error": "Conflict", "message": "…"}` with the correct HTTP status.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 7, React Router 7, Lucide Icons |
| Styling | Plain CSS with CSS custom properties (no framework), light/dark theme via `[data-theme]` |
| Backend | Java 21+, Spring Boot 4.0, Spring Security 7, Spring Data JPA, Lombok |
| Database | PostgreSQL 16 (Docker); schema managed by Hibernate `ddl-auto=update` |
| Tests | JUnit 5 + MockMvc integration tests on PostgreSQL 16 via Testcontainers |
| DevOps | Docker Compose, GitHub Actions CI (frontend lint + build, backend build + tests) |

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
│   └── src/
│       ├── api/client.js       # fetch wrapper: JSON, error messages, 401 handling
│       ├── auth/               # AuthProvider, auth API calls, permission helpers
│       ├── layout/             # DashboardLayout, Sidebar, Topbar
│       ├── pages/              # 15 page components + auth pages
│       ├── routes/             # navigation.js (single page/permission registry), AppRoutes, Guards
│       ├── styles/theme.css    # CSS variables, components, themes, density
│       ├── ui/                 # Modal, Toggle, PageHeader, QuickActions, WavyBackground
│       └── utils/              # validators, CSV parse/export, formatting, audit event types
└── backend/
    └── src/
        ├── main/java/com/msframework/backend/
        │   ├── config/         # SecurityConfig, DatabaseSeeder, Permission, SystemRoles, Integrations
        │   ├── controller/     # 10 REST controllers
        │   ├── dto/            # Request/response records (no entity is ever serialized directly)
        │   ├── entity/         # JPA entities
        │   ├── exception/      # ApiException + GlobalExceptionHandler
        │   ├── repository/     # Spring Data repositories
        │   └── service/        # Users, password reset, import, audit, sessions, DB metadata
        └── test/               # Integration tests (PostgreSQL via Testcontainers)
```

---

## Database

Tables are created and updated automatically by Hibernate. On every start-up `DatabaseSeeder`:

- creates the four built-in roles and **syncs their permissions** with `SystemRoles.java`
- seeds **7 departments**, the **admin user** and **12 service connections** when those tables are empty
- repairs data from older versions (users without a role get it from the legacy `users.role` column, or MEMBER)

---

## Roadmap

- [x] Scaffold React frontend & Spring Boot backend
- [x] Wire up PostgreSQL via Docker Compose
- [x] Session-based auth (login, register, logout)
- [x] GitHub Actions CI pipeline (lint + build + tests)
- [x] Full CRUD for Users and Departments
- [x] Complete all 15 dashboard pages
- [x] Persistent light/dark theme, accent colors, compact density
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
- [ ] Versioned schema migrations (Flyway) instead of `ddl-auto=update`
