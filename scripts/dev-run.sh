#!/usr/bin/env bash
set -e

echo "[DEV-RUN] Starting MSFramework Development Environment..."

# Start Postgres (Docker)
echo "[DEV-RUN] Starting PostgreSQL..."
docker compose up -d

# Start backend (Spring Boot)
echo "[DEV-RUN] Starting backend..."
(
  cd backend
  ./mvnw spring-boot:run
) &

BACKEND_PID=$!

# Start frontend (React Vite)
echo "[DEV-RUN] Starting frontend..."
(
  cd frontend
  npm run dev
)

# Cleanup
# shellcheck disable=SC2064
trap "echo 'Stopping backend...'; kill $BACKEND_PID" EXIT