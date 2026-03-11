# MSFramework Dashboard

![CI Pipeline](https://img.shields.io/badge/build-passing-brightgreen?style=flat-square)
![React](https://img.shields.io/badge/React-18-blue?style=flat-square&logo=react)
![Spring Boot](https://img.shields.io/badge/Spring_Boot-4.0-success?style=flat-square&logo=spring-boot)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql)

A modern, modular company management tool built to handle the chaotic parts of running a business—users, departments, permissions, and eventually, cross-functional team management.

## The Vision
Managing a growing company usually means duct-taping together five different SaaS tools just to know who works in what department and what systems they have access to. MSFramework is an attempt to build a centralized dashboard where HR, IT, and management can collaborate in one place.

Right now, the project is in its early stages, starting with the absolute foundation: solid authentication, secure sessions, and basic user/department relations. The end goal is a full suite handling granular Role-Based Access Control (RBAC), cross-departmental overviews, and onboarding flows.

## Features (Current & Planned)
* **Secure Authentication:** Session-based auth with HTTP-only cookies (because stuffing JWTs in local storage is a security nightmare).
* **User & Department Management:** Onboard employees and dynamically assign them to specific company branches.
* **Role-Based Access Control (WIP):** Granular permissions so managers only see what they need to see.
* **Modern UI/UX:** Clean, responsive, and fast interface built with React and Vite.
* **Rock-Solid Backend:** Spring Boot 4 + Spring Security 6 under the hood, utilizing BCrypt password hashing and Java 21.

## Tech Stack
* **Frontend:** React, Vite, React Router, Lucide Icons
* **Backend:** Java 21, Spring Boot 4.0.3, Spring Security, Spring Data JPA
* **Database:** PostgreSQL (Containerized via Docker)
* **DevOps:** Docker Compose, GitHub Actions (Parallel CI testing for both frontend and backend)

## Getting Started (Local Development)

I've set up a bash script to make spinning this environment up as painless as possible. You'll need Docker, Node.js (v20+), and Java 21 installed on your machine.

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/msframework-admin-poc.git
   cd msframework-admin-poc
   ```

2. Run the development environment script:
   ```bash
   ./scripts/dev-run.sh
   ```

What the script does automatically:
* Spins up the PostgreSQL database in Docker (mapped to port 5433).
* Starts the Spring Boot backend.
* Starts the Vite frontend server and automatically proxies `/api` requests to bypass CORS restrictions.

*Note: Press `Ctrl+C` to cleanly kill both the frontend and backend child processes.*

## Roadmap
- [x] Scaffold React frontend & Spring Boot backend
- [x] Wire up PostgreSQL via Docker Compose
- [x] Implement Auth (Login/Register) with HTTP-Only sessions
- [x] Set up GitHub Actions CI pipeline
- [ ] Connect dynamic database users to the React Dashboard
- [ ] Build out full CRUD operations for Departments
- [ ] Implement password reset & email verification flows
- [ ] Expand RBAC (Role-Based Access Control) system
