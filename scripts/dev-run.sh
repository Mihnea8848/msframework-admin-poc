#!/usr/bin/env bash
set -e

PORT=5433

echo "[DEV-RUN] Starting MSFramework Development Environment..."

cleanup() {
  trap - EXIT INT TERM

  echo
  echo "[DEV-RUN] Cleaning up..."

  if [ -n "${BACKEND_PID:-}" ]; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi

  if [ -n "${FRONTEND_PID:-}" ]; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
}

free_port() {
  echo "[DEV-RUN] Checking port $PORT..."

  # Find PIDs listening on the port
  PIDS=$(sudo lsof -ti TCP:"$PORT" -sTCP:LISTEN || true)

  if [ -n "$PIDS" ]; then
    echo "[DEV-RUN] Port $PORT is in use by PID(s): $PIDS"
    echo "[DEV-RUN] Killing process(es) using port $PORT..."

    for PID in $PIDS; do
      sudo kill "$PID" 2>/dev/null || true
    done

    sleep 1

    # If still alive, force kill
    PIDS=$(sudo lsof -ti TCP:"$PORT" -sTCP:LISTEN || true)

    if [ -n "$PIDS" ]; then
      echo "[DEV-RUN] Process still alive. Force killing..."
      for PID in $PIDS; do
        sudo kill -9 "$PID" 2>/dev/null || true
      done
    fi
  fi
}

trap cleanup EXIT INT TERM

# Start Postgres Docker
echo "[DEV-RUN] Starting PostgreSQL..."

# Remove old container if it exists
docker rm -f msframework_db 2>/dev/null || true

# Free host port 5433
free_port

docker compose up -d

echo "[DEV-RUN] Waiting for PostgreSQL to be ready..."
until docker exec msframework_db pg_isready -U msframework -d msframework >/dev/null 2>&1; do
  sleep 1
done

# Start backend
echo "[DEV-RUN] Starting backend..."
(
  cd backend
  ./mvnw spring-boot:run
) &
BACKEND_PID=$!

# Start frontend
echo "[DEV-RUN] Starting frontend..."
(
  cd frontend
  npm run dev
) &
FRONTEND_PID=$!

wait