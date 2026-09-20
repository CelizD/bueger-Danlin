#!/bin/sh
set -eu

: "${S3_ENDPOINT_URL:?S3_ENDPOINT_URL is required}"
: "${S3_BUCKET:?S3_BUCKET is required}"
: "${AWS_ACCESS_KEY_ID:?AWS_ACCESS_KEY_ID is required}"
: "${AWS_SECRET_ACCESS_KEY:?AWS_SECRET_ACCESS_KEY is required}"

AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-de}"
export AWS_DEFAULT_REGION

aws_args="--endpoint-url ${S3_ENDPOINT_URL}"

echo "Checking offsite bucket versioning..."
VERSIONING="$(
  aws s3api get-bucket-versioning     --bucket "${S3_BUCKET}"     --endpoint-url "${S3_ENDPOINT_URL}"     --query Status     --output text
)"

if [ "${VERSIONING}" != "Enabled" ]; then
  echo "Offsite bucket must have Versioning enabled; current state: ${VERSIONING}" >&2
  exit 1
fi

echo "Checking Object Lock..."
LOCK_ENABLED="$(
  aws s3api get-object-lock-configuration     --bucket "${S3_BUCKET}"     --endpoint-url "${S3_ENDPOINT_URL}"     --query 'ObjectLockConfiguration.ObjectLockEnabled'     --output text
)"

if [ "${LOCK_ENABLED}" != "Enabled" ]; then
  echo "Offsite bucket must have Object Lock enabled." >&2
  exit 1
fi

LOCK_MODE="$(
  aws s3api get-object-lock-configuration     --bucket "${S3_BUCKET}"     --endpoint-url "${S3_ENDPOINT_URL}"     --query 'ObjectLockConfiguration.Rule.DefaultRetention.Mode'     --output text
)"

RETENTION_DAYS="$(
  aws s3api get-object-lock-configuration     --bucket "${S3_BUCKET}"     --endpoint-url "${S3_ENDPOINT_URL}"     --query 'ObjectLockConfiguration.Rule.DefaultRetention.Days'     --output text
)"

RETENTION_YEARS="$(
  aws s3api get-object-lock-configuration     --bucket "${S3_BUCKET}"     --endpoint-url "${S3_ENDPOINT_URL}"     --query 'ObjectLockConfiguration.Rule.DefaultRetention.Years'     --output text
)"

case "${LOCK_MODE}" in
  GOVERNANCE|COMPLIANCE) ;;
  *)
    echo "Object Lock is enabled but no default retention mode was found." >&2
    exit 1
    ;;
esac

if { [ "${RETENTION_DAYS}" = "None" ] || [ -z "${RETENTION_DAYS}" ]; }   && { [ "${RETENTION_YEARS}" = "None" ] || [ -z "${RETENTION_YEARS}" ]; }; then
  echo "Object Lock needs a default retention period for automatic uploads." >&2
  exit 1
fi

echo "Offsite bucket verified."
echo "Versioning: Enabled"
echo "Object Lock mode: ${LOCK_MODE}"
if [ "${RETENTION_DAYS}" != "None" ] && [ -n "${RETENTION_DAYS}" ]; then
  echo "Default retention: ${RETENTION_DAYS} day(s)"
else
  echo "Default retention: ${RETENTION_YEARS} year(s)"
fi
