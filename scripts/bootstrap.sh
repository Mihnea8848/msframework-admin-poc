#!/usr/bin/env bash
set -euo pipefail

# ---- config (edit if you want) ----
APP_NAME="MSFranework"
GROUP_ID="com.mehstudiosinc"
ARTIFACT_ID="backend"
PACKAGE_NAME="com.mehstudiosinc.msframework"
JAVA_VERSION="21"
BOOT_VERSION="3.3.2"

FRONTEND_DIR="frontend"
BACKEND_DIR="backend"

# ---- checks ----
command -v curl >/dev/null || { echo "curl required"; exit 1; }
command -v unzip >/dev/null || { echo "unzip required"; exit 1; }
command -v npm >/dev/null || { echo "npm required"; exit 1; }

# ---- backend via Spring Initializr ----
if [ ! -f "$BACKEND_DIR/pom.xml" ]; then
  echo "Generating Spring Boot backend in ./$BACKEND_DIR ..."
  tmpzip="$(mktemp)"
  curl -sSL "https://start.spring.io/starter.zip\
?type=maven-project\
&language=java\
&groupId=${GROUP_ID}\
&artifactId=${ARTIFACT_ID}\
&name=${ARTIFACT_ID}\
&packageName=${PACKAGE_NAME}\
&dependencies=web,security,data-jpa,validation,postgresql,flyway,lombok" \
    -o "$tmpzip"
  unzip -q "$tmpzip" -d "$BACKEND_DIR"
  rm -f "$tmpzip"
else
  echo "Backend already exists, skipping."
fi

# ---- frontend via Vite ----
if [ ! -f "$FRONTEND_DIR/package.json" ]; then
  echo "Generating React frontend (Vite) in ./$FRONTEND_DIR ..."
  npm create vite@latest "$FRONTEND_DIR" -- --template react
  (cd "$FRONTEND_DIR" && npm install)
else
  echo "Frontend already exists, skipping."
fi

# ---- bootstrap CSS ----
if [ -f "$FRONTEND_DIR/package.json" ]; then
  echo "Installing Bootstrap..."
  (cd "$FRONTEND_DIR" && npm install bootstrap)
fi

# ---- basic backend config ----
app_yml="$BACKEND_DIR/src/main/resources/application.yml"
if [ -f "$app_yml" ]; then
  if ! grep -q "msframework" "$app_yml"; then
    cat > "$app_yml" <<'YAML'
server:
  port: 8080

spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/msframework
    username: msframework
    password: msframework
  jpa:
    hibernate:
      ddl-auto: validate
  flyway:
    enabled: true

app:
  cors:
    allowed-origin: "http://localhost:5173"
  upload:
    dir: "./data/uploads"
YAML
  fi
fi

# ---- create upload dir + gitkeep ----
mkdir -p data/uploads
touch data/uploads/.gitkeep

echo "Done ✅"
echo "Next:"
echo "  ./scripts/dev-up.sh           # start Postgres"
echo "  (cd backend && ./mvnw spring-boot:run)"
echo "  (cd frontend && npm run dev)"