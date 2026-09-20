FROM postgres:18-alpine

RUN apk add --no-cache age aws-cli ca-certificates tzdata

COPY deploy/backup/backup.sh /opt/backup/backup.sh
COPY deploy/backup/restore.sh /opt/backup/restore.sh
COPY deploy/backup/restore-drill.sh /opt/backup/restore-drill.sh
COPY deploy/backup/offsite-verify.sh /opt/backup/offsite-verify.sh
COPY deploy/backup/offsite-upload.sh /opt/backup/offsite-upload.sh
COPY deploy/backup/offsite-fetch-latest.sh /opt/backup/offsite-fetch-latest.sh

RUN sed -i 's/\r$//' /opt/backup/*.sh \
  && chmod 0555 /opt/backup/*.sh

ENTRYPOINT ["/bin/sh"]
CMD ["/opt/backup/backup.sh"]
