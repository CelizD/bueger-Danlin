#!/bin/sh
set -eu

umask 077

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_AGE_RECIPIENT:?BACKUP_AGE_RECIPIENT is required}"

BACKUP_DIR="/backups"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
PREFIX="${BACKUP_PREFIX:-burger-danlin}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BASENAME="${PREFIX}-${TIMESTAMP}.dump.age"
FINAL_PATH="${BACKUP_DIR}/${BASENAME}"
TEMP_DUMP="/tmp/${PREFIX}-${TIMESTAMP}.dump"
TEMP_ENCRYPTED="/tmp/${BASENAME}"

mkdir -p "${BACKUP_DIR}"

cleanup() {
  rm -f "${TEMP_DUMP}" "${TEMP_ENCRYPTED}"
}
trap cleanup EXIT INT TERM

echo "Creating PostgreSQL backup..."
pg_dump "${DATABASE_URL}"   --format=custom   --compress=9   --no-owner   --no-acl   --file="${TEMP_DUMP}"

echo "Encrypting backup with age..."
age   --recipient "${BACKUP_AGE_RECIPIENT}"   --output "${TEMP_ENCRYPTED}"   "${TEMP_DUMP}"

mv "${TEMP_ENCRYPTED}" "${FINAL_PATH}"

(
  cd "${BACKUP_DIR}"
  sha256sum "${BASENAME}" > "${BASENAME}.sha256"
)

find "${BACKUP_DIR}"   -type f   \( -name "${PREFIX}-*.dump.age" -o -name "${PREFIX}-*.dump.age.sha256" \)   -mtime "+${RETENTION_DAYS}"   -delete

SIZE_BYTES="$(wc -c < "${FINAL_PATH}" | tr -d ' ')"

echo "Backup complete: ${FINAL_PATH}"
echo "Encrypted bytes: ${SIZE_BYTES}"
