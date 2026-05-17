# MSFramework Dashboard

![CI Pipeline](https://img.shields.io/badge/build-passing-brightgreen?style=flat-square)
![React](https://img.shields.io/badge/React-19-blue?style=flat-square&logo=react)
![Spring Boot](https://img.shields.io/badge/Spring_Boot-4.0-success?style=flat-square&logo=spring-boot)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql)

A modern, full-stack company administration dashboard. Centralizes user management, department structure, integrations, security monitoring, and audit logging in a single interface — replacing the usual patchwork of disconnected SaaS tools.

---

## Features

### Frontend (15 pages)

| Page | Route | Description |
|---|---|---|
| Home | `/` | Overview grid with live KPIs linking to every section |
| Dashboard | `/dashboard` | KPI cards (users, active, admins, departments) + recent activity feed |
| User Management | `/users` | Full CRUD for users — create, edit role/status/department, delete |
| Departments | `/departments` | Create, rename, recolor, and delete departments with member counts |
| Notifications | `/notifications` | Live audit log fed from the backend — every action by any user appears here |
| Appearance | `/appearance` | Light/dark theme toggle, 6 accent colors, comfortable/compact density — all persisted |
| Database | `/database` | Browse live schema and row counts for Users and Departments tables |
| Documentation | `/docs` | Accordion-style inline docs covering every feature |
| Authentication | `/auth` | Change email/password (wired to backend), MFA toggle (UI), connected accounts (UI) |
| Security | `/security` | Security score ring, vulnerability checks computed from live data, recent alerts |
| Payments | `/payments` | Balance display, transaction history, Quick Pay form (proof of concept) |
| Import Data | `/import` | CSV upload with drag-and-drop, client-side preview and column mapping |
| Export Data | `/export` | Column-selectable CSV download generated from live API data |
| Connections | `/connections` | Manage service integrations (12 services), webhooks, and API keys — all DB-persisted |
| Timezones | `/timezones` | Live world clocks, add custom timezones, set org default (DB-persisted) |

**Cross-cutting UI features:**
- Persistent light/dark theme with flash-free restore on page load
- Quick Actions palette (⌘K / Ctrl+K) — search and navigate to any page via keyboard
- Topbar shows logged-in user avatar (initials), name, settings shortcut, and logout button
- Fully responsive layout with sidebar collapse on mobile

### Backend (REST API)

| Controller | Endpoints |
|---|---|
| `AuthController` | `POST /login`, `GET /me`, `POST /register`, `POST /logout`, `POST /email`, `POST /password` |
| `UserController` | `GET /api/users` |
| `DepartmentController` | `GET`, `POST`, `PUT /{id}`, `DELETE /{id}` under `/api/departments` |
| `AuditController` | `GET /api/audit`, `POST /api/audit/event` |
| `ConnectionsController` | `GET /api/connections`, `POST /{id}/connect`, `POST /{id}/disconnect`, `PATCH /{id}/toggle` |
| `WebhookController` | `GET /api/webhooks`, `POST`, `DELETE /{id}`, `PATCH /{id}/toggle` |
| `ApiKeyController` | `GET /api/keys`, `POST`, `DELETE /{id}` |
| `OrgSettingController` | `GET /api/settings/{key}`, `PUT /api/settings/{key}` |

**Audit logging** is wired into every mutating endpoint. Login, logout, department CRUD, connection toggles, webhook add/remove, API key generate/revoke, email/password changes, and CSV exports all produce rows in the `audit_events` table that appear on the Notifications page in real time for all connected users.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, React Router v7, Lucide Icons |
| Styling | Plain CSS with CSS custom properties (no framework), light/dark theme via `[data-theme]` |
| Backend | Java 21, Spring Boot 4.0, Spring Security 6, Spring Data JPA |
| Database | PostgreSQL 16 (Docker), schema managed by Hibernate `ddl-auto=update` |
| Auth | Session-based (HTTP-only cookies), BCrypt password hashing |
| DevOps | Docker Compose, GitHub Actions CI (parallel frontend lint + backend build) |

---

## Getting Started

**Prerequisites:** Docker, Node.js v20+, Java 21

### 1. Clone

```bash
git clone https://github.com/Mihnea8848/msframework-admin-poc.git
cd msframework-admin-poc
```

### 2. Start everything

```bash
./scripts/dev-run.sh
```

The script:
1. Starts PostgreSQL in Docker on port **5433**
2. Starts the Spring Boot backend on port **8080**
3. Starts the Vite dev server on port **5173** (proxies `/api` → `localhost:8080`)

Press `Ctrl+C` to cleanly stop all three processes.

### 3. Open the app

```
http://localhost:5173
```

Default credentials seeded on first run:

| Field | Value |
|---|---|
| Email | `admin@test.com` |
| Password | `password123` |

### LAN access (other devices on the same network)

The Vite server is configured with `host: '0.0.0.0'`, so after starting you'll see a **Network** URL printed in the terminal (e.g. `http://192.168.x.x:5173`). Any device on the same network can use that address.

---

## Project Structure

```
msframework-admin-poc/
├── scripts/
│   └── dev-run.sh              # One-command dev environment startup
├── frontend/
│   ├── src/
│   │   ├── auth/               # AuthProvider, useAuth, auth API helpers
│   │   ├── layout/             # DashboardLayout, Sidebar, Topbar
│   │   ├── pages/              # 15 page components (one per route)
│   │   ├── routes/             # AppRoutes, Guards (RequireAuth, RedirectIfAuthed)
│   │   ├── styles/             # theme.css — all CSS variables, components, dark/light themes
│   │   ├── ui/                 # QuickActions command palette, WavyBackground
│   │   └── utils/              # validators.js (password, email, name, phone)
│   └── vite.config.js
└── backend/
    └── src/main/java/com/msframework/backend/
        ├── config/             # SecurityConfig, DatabaseSeeder
        ├── controller/         # 8 REST controllers
        ├── dto/                # Request/response DTOs
        ├── entity/             # User, Department, AuditEvent, ServiceConnection, Webhook, ApiKey, OrgSetting
        ├── repository/         # JPA repositories for all entities
        └── service/            # AuditService, AuthService
```

---

## Database

Tables are created automatically by Hibernate on first startup. The `DatabaseSeeder` runs once (checks `count() == 0`) to populate:

- **7 departments** (Administration, Development, Quality Control, External Affairs, Ethics & Regulations, Human Resources, Engineering & Innovation)
- **1 admin user** (`admin@test.com` / `password123`)
- **12 service connections** (Slack, GitHub, Google Workspace, Stripe pre-connected; 8 others available)

---

## Roadmap

- [x] Scaffold React frontend & Spring Boot backend
- [x] Wire up PostgreSQL via Docker Compose
- [x] Implement session-based auth (login, register, logout)
- [x] GitHub Actions CI pipeline (lint + build)
- [x] Full CRUD for Users and Departments
- [x] Complete all 15 dashboard pages
- [x] Persistent light/dark theme + accent color picker
- [x] ⌘K Quick Actions command palette
- [x] Real-time audit log (Notifications page backed by DB)
- [x] Connections: integrations, webhooks, API keys — all DB-persisted
- [x] Org timezone setting persisted in DB
- [x] Email and password change endpoints
- [x] Topbar user profile with logout
- [x] LAN-accessible dev server
- [x] Password reset & email verification flows
- [x] Granular RBAC (role-based access control) beyond Admin/Member
- [ ] Real webhook delivery
- [ ] MFA (two-factor authentication) backend
