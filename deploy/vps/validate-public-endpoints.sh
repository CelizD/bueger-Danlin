#!/bin/sh
set -eu

WEB_ORIGIN="${WEB_ORIGIN:-}"
API_ORIGIN="${API_ORIGIN:-}"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

pass() {
  echo "PASS: $*"
}

require_https_origin() {
  name="$1"
  value="$2"

  case "$value" in
    https://*) ;;
    *) fail "$name must be an https:// origin" ;;
  esac
}

host_from_origin() {
  printf '%s' "$1" |
    sed -e 's#^https://##' -e 's#/.*$##' -e 's/:.*$//'
}

http_from_https() {
  printf '%s' "$1" | sed 's#^https://#http://#'
}

check_redirect() {
  origin="$1"
  http_origin="$(http_from_https "$origin")"
  headers="$(curl -sS -D - -o /dev/null "$http_origin/" || true)"
  status="$(printf '%s\n' "$headers" | awk 'toupper($1) ~ /^HTTP\// { code=$2 } END { print code }')"
  location="$(printf '%s\n' "$headers" | awk 'BEGIN{IGNORECASE=1} /^location:/ { sub(/^[^:]+:[[:space:]]*/, ""); gsub(/\r$/, ""); print; exit }')"

  case "$status" in
    301|302|307|308) ;;
    *) fail "$http_origin did not redirect to HTTPS (status: ${status:-unknown})" ;;
  esac

  case "$location" in
    https://*) pass "$http_origin redirects to HTTPS" ;;
    *) fail "$http_origin redirect location is not HTTPS" ;;
  esac
}

check_tls() {
  origin="$1"
  host="$(host_from_origin "$origin")"

  [ -n "$host" ] || fail "could not extract host from $origin"

  echo | openssl s_client     -connect "$host:443"     -servername "$host"     -tls1_2 >/dev/null 2>&1 ||
    fail "$host does not accept TLS 1.2"

  pass "$host accepts TLS 1.2"

  echo | openssl s_client     -connect "$host:443"     -servername "$host"     -tls1_3 >/dev/null 2>&1 ||
    fail "$host does not accept TLS 1.3"

  pass "$host accepts TLS 1.3"

  certificate="$(
    echo | openssl s_client       -connect "$host:443"       -servername "$host" 2>/dev/null |
      openssl x509 -outform PEM
  )"

  [ -n "$certificate" ] || fail "could not read certificate for $host"

  printf '%s\n' "$certificate" |
    openssl x509 -noout -checkend 604800 >/dev/null ||
    fail "$host certificate expires in less than 7 days"

  pass "$host certificate is valid for more than 7 days"

  if openssl x509 -help 2>&1 | grep -q -- '-checkhost'; then
    printf '%s\n' "$certificate" |
      openssl x509 -noout -checkhost "$host" >/dev/null ||
      fail "$host certificate hostname validation failed"

    pass "$host certificate matches hostname"
  fi
}

check_header() {
  headers="$1"
  header="$2"
  label="$3"

  printf '%s\n' "$headers" |
    grep -qi "^${header}:" ||
    fail "$label is missing $header"

  pass "$label includes $header"
}

command -v curl >/dev/null 2>&1 || fail "curl is not installed"
command -v openssl >/dev/null 2>&1 || fail "openssl is not installed"

require_https_origin "WEB_ORIGIN" "$WEB_ORIGIN"
require_https_origin "API_ORIGIN" "$API_ORIGIN"

curl -fsS "$WEB_ORIGIN/" >/dev/null ||
  fail "Web origin is not reachable over validated HTTPS"
pass "Web origin is reachable over HTTPS"

curl -fsS "$API_ORIGIN/api/v1/health/ready" >/dev/null ||
  fail "API readiness endpoint is not healthy over validated HTTPS"
pass "API readiness is healthy over HTTPS"

check_redirect "$WEB_ORIGIN"
check_redirect "$API_ORIGIN"

check_tls "$WEB_ORIGIN"
check_tls "$API_ORIGIN"

web_headers="$(curl -fsSI "$WEB_ORIGIN/")"
api_headers="$(curl -fsSI "$API_ORIGIN/api/v1/health/ready")"

check_header "$web_headers" "strict-transport-security" "Web"
check_header "$web_headers" "content-security-policy" "Web"
check_header "$web_headers" "x-content-type-options" "Web"
check_header "$web_headers" "x-frame-options" "Web"

check_header "$api_headers" "strict-transport-security" "API"
check_header "$api_headers" "x-content-type-options" "API"

echo "Real public endpoint validation passed."
