#!/bin/sh
set -eu

COMPOSE_FILE="${COMPOSE_FILE:-/opt/burger-danlin/docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-/etc/burger-danlin/production.env}"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

pass() {
  echo "PASS: $*"
}

command -v docker >/dev/null 2>&1 || fail "docker is not installed"
docker compose version >/dev/null 2>&1 || fail "docker compose plugin is not available"
pass "Docker and Compose available"

command -v nginx >/dev/null 2>&1 || fail "nginx is not installed"
nginx -t >/dev/null 2>&1 || fail "nginx configuration test failed"
pass "Nginx configuration valid"

[ -f "${COMPOSE_FILE}" ] || fail "compose file not found: ${COMPOSE_FILE}"
[ -f "${ENV_FILE}" ] || fail "production env not found: ${ENV_FILE}"

MODE="$(stat -c '%a' "${ENV_FILE}" 2>/dev/null || true)"
case "${MODE}" in
  600|400) pass "production env permissions are restrictive (${MODE})" ;;
  *) fail "production env permissions should be 600 or 400; found ${MODE:-unknown}" ;;
esac

docker compose   --env-file "${ENV_FILE}"   -f "${COMPOSE_FILE}"   config >/dev/null
pass "production Compose configuration resolves"

if command -v ss >/dev/null 2>&1; then
  if ss -lnt | grep -Eq '(^|[[:space:]])(0\.0\.0\.0|\[::\]):(5432|6379)[[:space:]]'; then
    fail "PostgreSQL or Redis is listening publicly on the host"
  fi
  pass "PostgreSQL/Redis are not listening publicly on host interfaces"
fi

if docker ps --format '{{.Names}} {{.Ports}}' | grep -E '0\.0\.0\.0:(5432|6379)->|\[::\]:(5432|6379)->' >/dev/null 2>&1; then
  fail "a running Docker container publishes PostgreSQL or Redis publicly"
fi
pass "Docker does not publish PostgreSQL/Redis publicly"

echo "VPS preflight completed successfully."
