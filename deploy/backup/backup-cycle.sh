#!/bin/sh
set -eu

/opt/backup/backup.sh

case "${OFFSITE_BACKUP_ENABLED:-false}" in
  true|TRUE|1|yes|YES)
    echo "Offsite backup enabled. Uploading encrypted backup..."
    /opt/backup/offsite-upload.sh
    ;;
  *)
    echo "Offsite backup disabled. Local encrypted backup completed."
    ;;
esac
