#!/bin/sh
set -eu

umask 077

: "${S3_ENDPOINT_URL:?S3_ENDPOINT_URL is required}"
: "${S3_BUCKET:?S3_BUCKET is required}"
: "${AWS_ACCESS_KEY_ID:?AWS_ACCESS_KEY_ID is required}"
: "${AWS_SECRET_ACCESS_KEY:?AWS_SECRET_ACCESS_KEY is required}"

AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-de}"
S3_PREFIX="${S3_PREFIX:-burger-danlin/postgres}"
BACKUP_PREFIX="${BACKUP_PREFIX:-burger-danlin}"
DEST_DIR="/backups/offsite-recovery"
export AWS_DEFAULT_REGION

mkdir -p "${DEST_DIR}"

if [ -n "${OFFSITE_BACKUP_KEY:-}" ]; then
  KEY="${OFFSITE_BACKUP_KEY}"
else
  KEY="$(
    aws s3 ls       "s3://${S3_BUCKET}/${S3_PREFIX%/}/"       --recursive       --endpoint-url "${S3_ENDPOINT_URL}" |
      awk '{print $4}' |
      grep "/${BACKUP_PREFIX}-.*\.dump\.age$" |
      sort |
      tail -n 1
  )"
fi

if [ -z "${KEY}" ]; then
  echo "No offsite encrypted backup found." >&2
  exit 1
fi

case "${KEY}" in
  *.dump.age) ;;
  *)
    echo "OFFSITE_BACKUP_KEY must point to a .dump.age object." >&2
    exit 1
    ;;
esac

BASENAME="$(basename "${KEY}")"
CHECKSUM_KEY="${KEY}.sha256"

echo "Downloading offsite backup..."
aws s3 cp   "s3://${S3_BUCKET}/${KEY}"   "${DEST_DIR}/${BASENAME}"   --endpoint-url "${S3_ENDPOINT_URL}"   --only-show-errors

aws s3 cp   "s3://${S3_BUCKET}/${CHECKSUM_KEY}"   "${DEST_DIR}/${BASENAME}.sha256"   --endpoint-url "${S3_ENDPOINT_URL}"   --only-show-errors

(
  cd "${DEST_DIR}"
  sha256sum -c "${BASENAME}.sha256"
)

echo "Offsite recovery copy downloaded and verified."
echo "Backup file: ${DEST_DIR}/${BASENAME}"
