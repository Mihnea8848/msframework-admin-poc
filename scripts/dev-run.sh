#!/usr/bin/env bash
# Starts the full development stack: PostgreSQL (Docker) -> Spring Boot backend -> Vite frontend.
# Ctrl+C stops the backend and frontend; the database container keeps running
# (stop it with `docker compose stop`).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_PORT=5433
BACKEND_PORT=8080
FRONTEND_PORT=5173

log() { printf '\033[1;36m[dev-run]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[dev-run]\033[0m %s\n' "$*" >&2; exit 1; }

port_in_use() {
  if command -v ss >/dev/null 2>&1; then
    ss -ltn "( sport = :$1 )" 2>/dev/null | grep -q LISTEN
  else
    (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null
  fi
}

# ---- prerequisites -----------------------------------------------------------
command -v docker >/dev/null || die "Docker is not installed."
docker info >/dev/null 2>&1 || die "Cannot talk to Docker. Is the daemon running, and is your user in the 'docker' group? (sudo usermod -aG docker \$USER, then log in again)"
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is required (the 'docker compose' command)."
command -v java >/dev/null || die "Java is not installed. Install JDK 21 or newer."
JAVA_MAJOR="$(java -XshowSettings:properties -version 2>&1 | awk -F'= ' '/java.specification.version/ {print $2}' | cut -d. -f1)"
[ "${JAVA_MAJOR:-0}" -ge 21 ] || die "JDK 21 or newer is required (found Java ${JAVA_MAJOR:-unknown}). Set JAVA_HOME or PATH."
command -v npm >/dev/null || die "Node.js/npm is not installed. Install Node.js 20.19+ or 22+."

for port in "$BACKEND_PORT" "$FRONTEND_PORT"; do
  port_in_use "$port" && die "Port $port is already in use. Stop whatever is running there (e.g. an old backend/frontend) and retry."
done

# ---- database ------------------------------------------------------------------
cd "$ROOT"
if ! docker compose ps --status running --services 2>/dev/null | grep -qx db; then
  if port_in_use "$DB_PORT"; then
    die "Port $DB_PORT is used by another program (a local PostgreSQL?). Stop it, or change the port in docker-compose.yml and DB_URL."
  fi
  log "Starting PostgreSQL on port $DB_PORT..."
  docker compose up -d --wait db || die "PostgreSQL did not become healthy. Check 'docker compose logs db'."
else
  log "PostgreSQL is already running."
fi

# The container healthcheck runs *inside* the container, so also confirm the host can reach
# PostgreSQL through the published port: send a protocol SSLRequest and expect 'S' or 'N' back.
# (A VPN such as a Tailscale exit node can swallow traffic to Docker's bridge network.)
pg_reachable() {
  local reply=""
  { exec 3<>"/dev/tcp/127.0.0.1/$DB_PORT"; } 2>/dev/null || return 1
  printf '\x00\x00\x00\x08\x04\xd2\x16\x2f' >&3
  IFS= read -r -n1 -t 3 reply <&3 || true
  exec 3<&- 3>&-
  [ "$reply" = "S" ] || [ "$reply" = "N" ]
}
if ! pg_reachable; then
  die "PostgreSQL is healthy inside Docker but not reachable on localhost:$DB_PORT. A VPN is probably routing Docker's network (check 'ip route get $(docker inspect msframework_db --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' 2>/dev/null)'). With Tailscale: 'tailscale set --exit-node-allow-lan-access=true' or disable the exit node. See AGENTS.md > Troubleshooting."
fi
log "PostgreSQL is reachable on localhost:$DB_PORT."

# ---- frontend dependencies -----------------------------------------------------
if [ ! -d "$ROOT/frontend/node_modules" ]; then
  log "Installing frontend dependencies (npm ci)..."
  (cd "$ROOT/frontend" && npm ci)
fi

# ---- app processes -------------------------------------------------------------
PIDS=()
cleanup() {
  trap - EXIT INT TERM
  echo
  log "Stopping backend and frontend..."
  for pid in "${PIDS[@]}"; do
    pkill -TERM -P "$pid" 2>/dev/null || true
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
  log "Done. The database is still running (docker compose stop)."
}
trap cleanup EXIT INT TERM

log "Starting backend on http://localhost:$BACKEND_PORT ..."
(cd "$ROOT/backend" && exec ./mvnw -q spring-boot:run) &
PIDS+=($!)

log "Waiting for the backend to accept requests..."
for _ in $(seq 1 180); do
  if curl -fsS -o /dev/null "http://localhost:$BACKEND_PORT/api/auth/me" 2>/dev/null; then
    break
  fi
  kill -0 "${PIDS[0]}" 2>/dev/null || die "The backend exited during start-up. See the output above."
  sleep 1
done

log "Starting frontend on http://localhost:$FRONTEND_PORT ..."
(cd "$ROOT/frontend" && exec npm run dev -- --port "$FRONTEND_PORT" --strictPort) &
PIDS+=($!)

log "Ready: open http://localhost:$FRONTEND_PORT  (default login admin@test.com / password123)"
wait
