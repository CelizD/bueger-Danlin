#!/bin/sh
set -eu

umask 077

: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL is required}"
: "${BACKUP_FILE:?BACKUP_FILE is required}"
: "${CONFIRM_DESTRUCTIVE_RESTORE:?Set CONFIRM_DESTRUCTIVE_RESTORE=RESTORE}"

if [ "${CONFIRM_DESTRUCTIVE_RESTORE}" != "RESTORE" ]; then
  echo "Refusing destructive restore. Set CONFIRM_DESTRUCTIVE_RESTORE=RESTORE." >&2
  exit 1
fi

IDENTITY="${BACKUP_AGE_IDENTITY:-/run/secrets/backup-age.key}"

case "${BACKUP_FILE}" in
  /*) BACKUP_PATH="${BACKUP_FILE}" ;;
  *) BACKUP_PATH="/backups/${BACKUP_FILE}" ;;
esac

if [ ! -f "${BACKUP_PATH}" ] || [ ! -f "${BACKUP_PATH}.sha256" ]; then
  echo "Backup or checksum file not found." >&2
  exit 1
fi

TEMP_DUMP="/tmp/restore.dump"

cleanup() {
  rm -f "${TEMP_DUMP}"
}
trap cleanup EXIT INT TERM

(
  cd "$(dirname "${BACKUP_PATH}")"
  sha256sum -c "$(basename "${BACKUP_PATH}.sha256")"
)

age   --decrypt   --identity "${IDENTITY}"   --output "${TEMP_DUMP}"   "${BACKUP_PATH}"

pg_restore --list "${TEMP_DUMP}" >/dev/null

echo "WARNING: restoring will replace objects in the target database."
pg_restore   --clean   --if-exists   --exit-on-error   --no-owner   --no-acl   --dbname="${RESTORE_DATABASE_URL}"   "${TEMP_DUMP}"

echo "Restore completed successfully."
