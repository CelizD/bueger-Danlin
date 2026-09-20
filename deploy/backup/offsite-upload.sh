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
export AWS_DEFAULT_REGION

/opt/backup/offsite-verify.sh

BACKUP_PATH="$(ls -1t /backups/${BACKUP_PREFIX}-*.dump.age 2>/dev/null | head -n 1 || true)"

if [ -z "${BACKUP_PATH}" ] || [ ! -f "${BACKUP_PATH}" ]; then
  echo "No encrypted local backup found to upload." >&2
  exit 1
fi

CHECKSUM_PATH="${BACKUP_PATH}.sha256"

if [ ! -f "${CHECKSUM_PATH}" ]; then
  echo "Checksum file not found for ${BACKUP_PATH}" >&2
  exit 1
fi

(
  cd /backups
  sha256sum -c "$(basename "${CHECKSUM_PATH}")"
)

BASENAME="$(basename "${BACKUP_PATH}")"
CHECKSUM_BASENAME="$(basename "${CHECKSUM_PATH}")"
REMOTE_PREFIX="${S3_PREFIX%/}"
REMOTE_KEY="${REMOTE_PREFIX}/${BASENAME}"
REMOTE_CHECKSUM_KEY="${REMOTE_PREFIX}/${CHECKSUM_BASENAME}"

echo "Uploading encrypted backup to offsite storage..."
aws s3 cp   "${BACKUP_PATH}"   "s3://${S3_BUCKET}/${REMOTE_KEY}"   --endpoint-url "${S3_ENDPOINT_URL}"   --only-show-errors

aws s3 cp   "${CHECKSUM_PATH}"   "s3://${S3_BUCKET}/${REMOTE_CHECKSUM_KEY}"   --endpoint-url "${S3_ENDPOINT_URL}"   --only-show-errors

LOCAL_SIZE="$(wc -c < "${BACKUP_PATH}" | tr -d ' ')"
REMOTE_SIZE="$(
  aws s3api head-object     --bucket "${S3_BUCKET}"     --key "${REMOTE_KEY}"     --endpoint-url "${S3_ENDPOINT_URL}"     --query ContentLength     --output text
)"

if [ "${LOCAL_SIZE}" != "${REMOTE_SIZE}" ]; then
  echo "Offsite upload verification failed: size mismatch." >&2
  exit 1
fi

REMOTE_CHECKSUM_SIZE="$(
  aws s3api head-object     --bucket "${S3_BUCKET}"     --key "${REMOTE_CHECKSUM_KEY}"     --endpoint-url "${S3_ENDPOINT_URL}"     --query ContentLength     --output text
)"
LOCAL_CHECKSUM_SIZE="$(wc -c < "${CHECKSUM_PATH}" | tr -d ' ')"

if [ "${LOCAL_CHECKSUM_SIZE}" != "${REMOTE_CHECKSUM_SIZE}" ]; then
  echo "Offsite checksum upload verification failed: size mismatch." >&2
  exit 1
fi

echo "Offsite upload verified."
echo "Object: s3://${S3_BUCKET}/${REMOTE_KEY}"
echo "Encrypted bytes: ${REMOTE_SIZE}"
