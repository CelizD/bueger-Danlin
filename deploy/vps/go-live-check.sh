#!/bin/sh
set -eu

ENV_FILE="${ENV_FILE:-/etc/burger-danlin/production.env}"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

pass() {
  echo "PASS: $*"
}

[ -f "${ENV_FILE}" ] || fail "production env not found: ${ENV_FILE}"

get_env() {
  key="$1"
  value="$(grep -E "^${key}=" "${ENV_FILE}" | tail -n 1 | cut -d= -f2- || true)"
  printf '%s' "${value}"
}

APP_ORIGIN="$(get_env APP_ORIGIN)"
API_URL="$(get_env NEXT_PUBLIC_API_URL)"
PAYMENT_PROVIDER="$(get_env PAYMENT_PROVIDER)"
OFFSITE_ENABLED="$(get_env OFFSITE_BACKUP_ENABLED)"
AUTH_SECRET="$(get_env AUTH_JWT_SECRET)"
QR_SECRET="$(get_env QR_TOKEN_SECRET)"
MFA_KEY="$(get_env MFA_ENCRYPTION_KEY)"
POSTGRES_ADMIN_USER="$(get_env POSTGRES_ADMIN_USER)"
POSTGRES_RUNTIME_USER="$(get_env POSTGRES_RUNTIME_USER)"

case "${APP_ORIGIN}" in
  https://*example.com*|"") fail "APP_ORIGIN must be a real HTTPS production origin" ;;
  https://*) pass "APP_ORIGIN uses a real-looking HTTPS origin" ;;
  *) fail "APP_ORIGIN must use HTTPS" ;;
esac

case "${API_URL}" in
  https://*example.com*|"") fail "NEXT_PUBLIC_API_URL must be a real HTTPS production URL" ;;
  https://*) pass "NEXT_PUBLIC_API_URL uses a real-looking HTTPS URL" ;;
  *) fail "NEXT_PUBLIC_API_URL must use HTTPS" ;;
esac

case "${PAYMENT_PROVIDER}" in
  stripe|mercadopago) pass "real payment provider selected: ${PAYMENT_PROVIDER}" ;;
  mock|"") fail "PAYMENT_PROVIDER=mock is not allowed for go-live" ;;
  *) fail "unsupported production payment provider: ${PAYMENT_PROVIDER}" ;;
esac

case "${OFFSITE_ENABLED}" in
  true|TRUE|1|yes|YES) pass "offsite backup enabled" ;;
  *) fail "OFFSITE_BACKUP_ENABLED must be true before go-live" ;;
esac

[ "${#AUTH_SECRET}" -ge 48 ] || fail "AUTH_JWT_SECRET is missing or too short"
[ "${#QR_SECRET}" -ge 48 ] || fail "QR_TOKEN_SECRET is missing or too short"
[ "${AUTH_SECRET}" != "${QR_SECRET}" ] || fail "AUTH_JWT_SECRET and QR_TOKEN_SECRET must differ"
pass "JWT/QR secrets satisfy minimum length and separation"

[ -n "${MFA_KEY}" ] || fail "MFA_ENCRYPTION_KEY is missing"
pass "MFA encryption key is configured"

for key in   POSTGRES_ADMIN_USER   POSTGRES_ADMIN_PASSWORD   POSTGRES_RUNTIME_USER   POSTGRES_RUNTIME_PASSWORD   REDIS_PASSWORD   BACKUP_AGE_RECIPIENT   S3_ENDPOINT_URL   S3_BUCKET   S3_ACCESS_KEY_ID   S3_SECRET_ACCESS_KEY
do
  value="$(get_env "${key}")"
  [ -n "${value}" ] || fail "${key} is required before go-live"
done
[ "${POSTGRES_ADMIN_USER}" != "${POSTGRES_RUNTIME_USER}" ] || fail "POSTGRES_ADMIN_USER and POSTGRES_RUNTIME_USER must be different"
pass "database admin/runtime identities are separated"
pass "database, Redis, backup encryption, and offsite storage settings are present"

case "${PAYMENT_PROVIDER}" in
  stripe)
    [ -n "$(get_env STRIPE_SECRET_KEY)" ] || fail "STRIPE_SECRET_KEY is required"
    [ -n "$(get_env STRIPE_WEBHOOK_SECRET)" ] || fail "STRIPE_WEBHOOK_SECRET is required"
    ;;
  mercadopago)
    [ -n "$(get_env MERCADOPAGO_ACCESS_TOKEN)" ] || fail "MERCADOPAGO_ACCESS_TOKEN is required"
    [ -n "$(get_env MERCADOPAGO_WEBHOOK_SECRET)" ] || fail "MERCADOPAGO_WEBHOOK_SECRET is required"
    ;;
esac
pass "payment provider secrets are present"

echo "Go-live environment gate passed."
