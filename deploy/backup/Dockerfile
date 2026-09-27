FROM postgres:18-alpine

RUN apk add --no-cache age aws-cli ca-certificates tzdata \
  && rm -f /usr/local/bin/gosu

RUN addgroup -S -g 10001 backup \
  && adduser -S -D -u 10001 -G backup -h /home/backup backup \
  && mkdir -p /home/backup /backups \
  && chown -R backup:backup /home/backup /backups

COPY deploy/backup/backup.sh /opt/backup/backup.sh
COPY deploy/backup/backup-cycle.sh /opt/backup/backup-cycle.sh
COPY deploy/backup/restore.sh /opt/backup/restore.sh
COPY deploy/backup/restore-drill.sh /opt/backup/restore-drill.sh
COPY deploy/backup/offsite-verify.sh /opt/backup/offsite-verify.sh
COPY deploy/backup/offsite-upload.sh /opt/backup/offsite-upload.sh
COPY deploy/backup/offsite-fetch-latest.sh /opt/backup/offsite-fetch-latest.sh

RUN sed -i 's/\r$//' /opt/backup/*.sh \
  && chmod 0555 /opt/backup/*.sh

USER backup

ENTRYPOINT ["/bin/sh"]
CMD ["/opt/backup/backup.sh"]