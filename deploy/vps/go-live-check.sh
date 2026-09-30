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
REAL_PAYMENTS="$(get_env ENABLE_REAL_PAYMENTS)"
OFFSITE_ENABLED="$(get_env OFFSITE_BACKUP_ENABLED)"
AUTH_SECRET="$(get_env AUTH_JWT_SECRET)"
QR_SECRET="$(get_env QR_TOKEN_SECRET)"
MFA_KEY="$(get_env MFA_ENCRYPTION_KEY)"
POSTGRES_ADMIN_USER="$(get_env POSTGRES_ADMIN_USER)"
POSTGRES_RUNTIME_USER="$(get_env POSTGRES_RUNTIME_USER)"
PRIVACY_RESPONSIBLE="$(get_env PRIVACY_RESPONSIBLE)"
PRIVACY_ADDRESS="$(get_env PRIVACY_ADDRESS)"
PRIVACY_EMAIL="$(get_env PRIVACY_EMAIL)"
BUSINESS_LEGAL_NAME="$(get_env BUSINESS_LEGAL_NAME)"
BUSINESS_TRADE_NAME="$(get_env BUSINESS_TRADE_NAME)"
BUSINESS_RFC="$(get_env BUSINESS_RFC)"
BUSINESS_ADDRESS="$(get_env BUSINESS_ADDRESS)"
SUPPORT_PHONE="$(get_env SUPPORT_PHONE)"
SUPPORT_EMAIL="$(get_env SUPPORT_EMAIL)"
EMAIL_NOTIFICATIONS_ENABLED="$(get_env EMAIL_NOTIFICATIONS_ENABLED)"
MAIL_HOST="$(get_env MAIL_HOST)"
MAIL_PORT="$(get_env MAIL_PORT)"
MAIL_SECURITY="$(get_env MAIL_SECURITY)"
MAIL_USERNAME="$(get_env MAIL_USERNAME)"
MAIL_PASSWORD="$(get_env MAIL_PASSWORD)"
MAIL_FROM="$(get_env MAIL_FROM)"
MAIL_REPLY_TO="$(get_env MAIL_REPLY_TO)"
MAIL_REJECT_UNAUTHORIZED="$(get_env MAIL_REJECT_UNAUTHORIZED)"

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
  mercadopago) pass "Mercado Pago selected for MVP" ;;
  mock|"") fail "PAYMENT_PROVIDER=mock is not allowed for go-live" ;;
  *) fail "MVP go-live currently supports PAYMENT_PROVIDER=mercadopago only" ;;
esac

case "${REAL_PAYMENTS}" in
  true|TRUE) pass "real payments kill switch enabled" ;;
  *) fail "ENABLE_REAL_PAYMENTS must be true before go-live" ;;
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

[ -n "${PRIVACY_RESPONSIBLE}" ] || fail "PRIVACY_RESPONSIBLE is required"
[ "${#PRIVACY_ADDRESS}" -ge 10 ] || fail "PRIVACY_ADDRESS must contain a real contact address"
case "${PRIVACY_EMAIL}" in
  *@*.*) pass "privacy notice identity and contact are configured" ;;
  *) fail "PRIVACY_EMAIL must be a valid contact email" ;;
esac

[ "${#BUSINESS_LEGAL_NAME}" -ge 3 ] || fail "BUSINESS_LEGAL_NAME is required"
[ -n "${BUSINESS_TRADE_NAME}" ] || fail "BUSINESS_TRADE_NAME is required"
case "${#BUSINESS_RFC}" in
  12|13) ;;
  *) fail "BUSINESS_RFC must contain a 12 or 13 character RFC" ;;
esac
[ "${#BUSINESS_ADDRESS}" -ge 10 ] || fail "BUSINESS_ADDRESS must contain a real physical contact address"
SUPPORT_PHONE_DIGITS="$(printf '%s' "${SUPPORT_PHONE}" | tr -cd '0-9')"
[ "${#SUPPORT_PHONE_DIGITS}" -ge 10 ] || fail "SUPPORT_PHONE must contain at least 10 digits"
case "${SUPPORT_EMAIL}" in
  *@*.*) pass "seller identity, RFC, address and support channels are configured" ;;
  *) fail "SUPPORT_EMAIL must be a valid support email" ;;
esac

case "${EMAIL_NOTIFICATIONS_ENABLED}" in
  true|TRUE|1|yes|YES) pass "purchase confirmation emails enabled" ;;
  *) fail "EMAIL_NOTIFICATIONS_ENABLED must be true before go-live" ;;
esac

[ -n "${MAIL_HOST}" ] || fail "MAIL_HOST is required"
case "${MAIL_PORT}" in
  ''|*[!0-9]*) fail "MAIL_PORT must be numeric" ;;
  *) [ "${MAIL_PORT}" -ge 1 ] && [ "${MAIL_PORT}" -le 65535 ] || fail "MAIL_PORT must be between 1 and 65535" ;;
esac

case "${MAIL_SECURITY}" in
  starttls|tls) pass "SMTP transport uses encrypted delivery" ;;
  *) fail "MAIL_SECURITY must be starttls or tls in production" ;;
esac

[ -n "${MAIL_USERNAME}" ] || fail "MAIL_USERNAME is required"
[ -n "${MAIL_PASSWORD}" ] || fail "MAIL_PASSWORD is required"
case "${MAIL_FROM}" in
  *@*.*) ;;
  *) fail "MAIL_FROM must contain a valid sender email" ;;
esac
case "${MAIL_REPLY_TO:-${SUPPORT_EMAIL}}" in
  *@*.*) ;;
  *) fail "MAIL_REPLY_TO must be a valid email when configured" ;;
esac
case "${MAIL_REJECT_UNAUTHORIZED}" in
  true|TRUE|1|yes|YES) pass "SMTP certificate verification enabled" ;;
  *) fail "MAIL_REJECT_UNAUTHORIZED must be true in production" ;;
esac
pass "SMTP purchase confirmation settings are present"

for key in   POSTGRES_ADMIN_USER   POSTGRES_ADMIN_PASSWORD   POSTGRES_RUNTIME_USER   POSTGRES_RUNTIME_PASSWORD   REDIS_PASSWORD   BACKUP_AGE_RECIPIENT   S3_ENDPOINT_URL   S3_BUCKET   S3_ACCESS_KEY_ID   S3_SECRET_ACCESS_KEY
do
  value="$(get_env "${key}")"
  [ -n "${value}" ] || fail "${key} is required before go-live"
done
[ "${POSTGRES_ADMIN_USER}" != "${POSTGRES_RUNTIME_USER}" ] || fail "POSTGRES_ADMIN_USER and POSTGRES_RUNTIME_USER must be different"
pass "database admin/runtime identities are separated"
pass "database, Redis, backup encryption, and offsite storage settings are present"

[ -n "$(get_env MERCADOPAGO_ACCESS_TOKEN)" ] || fail "MERCADOPAGO_ACCESS_TOKEN is required"
[ -n "$(get_env MERCADOPAGO_WEBHOOK_SECRET)" ] || fail "MERCADOPAGO_WEBHOOK_SECRET is required"
pass "Mercado Pago secrets are present"

echo "Go-live environment gate passed."
