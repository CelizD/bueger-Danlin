#!/bin/sh
set -eu

umask 077

: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL is required}"

IDENTITY="${BACKUP_AGE_IDENTITY:-/run/secrets/backup-age.key}"

if [ ! -f "${IDENTITY}" ]; then
  echo "Backup age identity not found: ${IDENTITY}" >&2
  exit 1
fi

if [ -n "${BACKUP_FILE:-}" ]; then
  case "${BACKUP_FILE}" in
    /*) BACKUP_PATH="${BACKUP_FILE}" ;;
    *) BACKUP_PATH="/backups/${BACKUP_FILE}" ;;
  esac
else
  BACKUP_PATH="$(ls -1t /backups/*.dump.age 2>/dev/null | head -n 1 || true)"
fi

if [ -z "${BACKUP_PATH}" ] || [ ! -f "${BACKUP_PATH}" ]; then
  echo "No encrypted backup was found for restore drill." >&2
  exit 1
fi

CHECKSUM_PATH="${BACKUP_PATH}.sha256"
TEMP_DUMP="/tmp/restore-drill.dump"

cleanup() {
  rm -f "${TEMP_DUMP}"
}
trap cleanup EXIT INT TERM

if [ ! -f "${CHECKSUM_PATH}" ]; then
  echo "Checksum file is missing: ${CHECKSUM_PATH}" >&2
  exit 1
fi

echo "Verifying encrypted backup checksum..."
(
  cd "$(dirname "${BACKUP_PATH}")"
  sha256sum -c "$(basename "${CHECKSUM_PATH}")"
)

echo "Decrypting backup into ephemeral storage..."
age   --decrypt   --identity "${IDENTITY}"   --output "${TEMP_DUMP}"   "${BACKUP_PATH}"

echo "Validating pg_dump archive..."
pg_restore --list "${TEMP_DUMP}" >/dev/null

echo "Restoring into isolated drill database..."
pg_restore   --exit-on-error   --no-owner   --no-acl   --dbname="${RESTORE_DATABASE_URL}"   "${TEMP_DUMP}"

TABLE_COUNT="$(
  psql "${RESTORE_DATABASE_URL}"     -v ON_ERROR_STOP=1     -Atc "SELECT count(*) FROM pg_tables WHERE schemaname = 'public';"
)"

MIGRATION_TABLE="$(
  psql "${RESTORE_DATABASE_URL}"     -v ON_ERROR_STOP=1     -Atc "SELECT to_regclass('public._prisma_migrations') IS NOT NULL;"
)"

if [ "${TABLE_COUNT}" -lt 1 ]; then
  echo "Restore drill failed: restored database has no public tables." >&2
  exit 1
fi

if [ "${MIGRATION_TABLE}" != "t" ]; then
  echo "Restore drill failed: _prisma_migrations is missing." >&2
  exit 1
fi

echo "Restore drill succeeded."
echo "Backup: ${BACKUP_PATH}"
echo "Restored public tables: ${TABLE_COUNT}"
