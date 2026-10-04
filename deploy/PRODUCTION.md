# Producción — Burger Danlin

Guía operativa para un VPS Linux con Docker Engine, Docker Compose plugin y Nginx en el host.

## Topología

```text
Internet
   |
   v
Nginx host :443
   |----------------------|
   v                      v
127.0.0.1:3000        127.0.0.1:4000
Web container          API container
                           |
                           v
                    Docker data network
                     |             |
                  PostgreSQL     Redis
                  no ports       no ports
```

PostgreSQL y Redis no publican puertos al host en `docker-compose.prod.yml`.

## 1. Directorios del host

```bash
sudo install -d -m 700 /etc/burger-danlin
sudo install -d -m 700 -o 10001 -g 10001 /var/backups/burger-danlin
sudo install -d -m 755 /opt/burger-danlin
```

Si `/var/backups/burger-danlin` ya existía antes de aplicar el usuario no-root del contenedor de backups:

```bash
sudo chown 10001:10001 /var/backups/burger-danlin
sudo chmod 700 /var/backups/burger-danlin
```

El UID/GID `10001` corresponde al usuario `backup` dentro de la imagen `burger-danlin-backup`.

El repositorio puede vivir en:

```text
/opt/burger-danlin
```

## 2. Configuración de producción

Copia la plantilla fuera del repositorio:

```bash
sudo cp deploy/production.env.example /etc/burger-danlin/production.env
sudo chmod 600 /etc/burger-danlin/production.env
sudoedit /etc/burger-danlin/production.env
```

Genera secretos distintos:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

No reutilices `AUTH_JWT_SECRET`, `QR_TOKEN_SECRET` ni `MFA_ENCRYPTION_KEY`.

Para PostgreSQL y Redis usa contraseñas largas que no contengan caracteres que rompan una URL si se construye `DATABASE_URL`. `base64url` es una opción práctica.

PostgreSQL usa dos identidades distintas:

- `POSTGRES_ADMIN_USER`: propietario/administrador de la base. Solo bootstrap, migraciones y backups.
- `POSTGRES_RUNTIME_USER`: rol de la API. No es superusuario, no puede crear roles, bases ni objetos en el esquema. Recibe únicamente permisos DML sobre las tablas de la aplicación.

Las contraseñas de ambos roles deben ser distintas.

La API solo recibe las variables `POSTGRES_RUNTIME_*`.

Para el MVP, `PAYMENT_PROVIDER` debe ser exactamente `mercadopago`. `mock` está reservado para desarrollo/pruebas y Stripe permanece reservado para una integración futura; la API rechaza esos valores en producción para evitar una configuración aparentemente válida pero no operativa.

`ENABLE_REAL_PAYMENTS` es un kill switch adicional y debe permanecer en `false` mientras preparas infraestructura y credenciales. Después de validar sandbox, webhooks firmados, reconciliación, pago fallido, refund y pruebas end-to-end, cámbialo a `true`. El `go-live-check.sh` exige `PAYMENT_PROVIDER=mercadopago`, `ENABLE_REAL_PAYMENTS=true` y los secretos de Mercado Pago antes de permitir el lanzamiento.

Si ya existe un volumen creado con el esquema anterior de un solo superusuario, sigue:

```text
deploy/postgres/MIGRATE_EXISTING_VOLUME.md
```

antes de arrancar la nueva configuración.

El bootstrap rechaza de forma segura un runtime que todavía sea propietario de la base, esquema o tablas.

## 3. Clave de backup age

Construye primero la utilidad:

```bash
cd /opt/burger-danlin

docker build \
  -f deploy/backup/Dockerfile \
  -t burger-danlin-backup .
```

La imagen de backups ejecuta normalmente como usuario no-root:

```text
uid=10001(backup)
gid=10001(backup)
```

El directorio `/etc/burger-danlin` está protegido para `root`, por lo que la generación inicial de la clave privada utiliza root únicamente durante esa operación puntual.

Genera la identidad privada:

```bash
sudo docker run --rm \
  --user 0:0 \
  -v /etc/burger-danlin:/keys \
  burger-danlin-backup \
  -c 'age-keygen -o /keys/backup-age.key'
```

Protege inmediatamente la clave:

```bash
sudo chmod 600 /etc/burger-danlin/backup-age.key
```

Comprueba sus permisos:

```bash
sudo ls -l /etc/burger-danlin/backup-age.key
```

Obtén el recipient público:

```bash
sudo grep "^# public key:" /etc/burger-danlin/backup-age.key
```

Copia únicamente el valor `age1...` a `BACKUP_AGE_RECIPIENT` dentro de:

```text
/etc/burger-danlin/production.env
```

La clave privada nunca debe entrar a:

- Git
- variables del frontend
- Dockerfiles
- logs
- imágenes Docker
- commits
- archivos `.env.example`

## 4. Validar configuración

```bash
docker compose \
  --env-file /etc/burger-danlin/production.env \
  -f docker-compose.prod.yml \
  config >/dev/null
```

Si falta una variable obligatoria, Compose debe fallar antes del despliegue.

## 5. Construir imágenes

```bash
docker compose \
  --env-file /etc/burger-danlin/production.env \
  -f docker-compose.prod.yml \
  build --pull
```

API y Web ejecutan Node como usuario no-root.

La imagen de backups también ejecuta como usuario no-root con UID/GID `10001`.

## 6. Levantar PostgreSQL y Redis

```bash
docker compose \
  --env-file /etc/burger-danlin/production.env \
  -f docker-compose.prod.yml \
  up -d postgres redis
```

Comprueba:

```bash
docker compose \
  --env-file /etc/burger-danlin/production.env \
  -f docker-compose.prod.yml \
  ps
```

No deben existir bindings públicos:

```text
0.0.0.0:5432
0.0.0.0:6379
```

PostgreSQL y Redis deben permanecer accesibles únicamente dentro de las redes Docker correspondientes.

## 7. Crear y verificar el rol runtime y ejecutar migraciones

El bootstrap es idempotente:

- crea el rol runtime si no existe;
- fuerza atributos no administrativos;
- aplica permisos mínimos actuales;
- aplica permisos por defecto para objetos futuros.

Ejecuta:

```bash
docker compose \
  --env-file /etc/burger-danlin/production.env \
  -f docker-compose.prod.yml \
  run --rm db-bootstrap
```

Después ejecuta las migraciones con el rol administrativo:

```bash
docker compose \
  --env-file /etc/burger-danlin/production.env \
  -f docker-compose.prod.yml \
  run --rm migrate
```

En producción se usa:

```text
prisma migrate deploy
```

No uses:

```text
prisma migrate dev
prisma db push
```

en producción.

La política obligatoria para cambios de esquema/datos es:

```text
docs/DATABASE_MIGRATIONS.md
```

Toda evolución debe clasificarse como **Expand → Migrate → Contract**. Los cambios destructivos se realizan en una release Contract posterior, después de migrar datos y comprobar que la estructura anterior ya no se usa.

Antes de ejecutar `migrate` en producción revisa el SQL pendiente y confirma un backup reciente. Para cambios de riesgo relevante, valida primero en staging.

## 8. Levantar aplicación

```bash
docker compose \
  --env-file /etc/burger-danlin/production.env \
  -f docker-compose.prod.yml \
  up -d api web
```

Verifica:

```bash
curl -fsS \
  -H 'X-Forwarded-Proto: https' \
  http://127.0.0.1:4000/api/v1/health/live
```

```bash
curl -fsS \
  -H 'X-Forwarded-Proto: https' \
  http://127.0.0.1:4000/api/v1/health/ready
```

```bash
curl -fsS \
  http://127.0.0.1:3000/ \
  >/dev/null
```

## 9. Observabilidad

Genera una contraseña fuerte para Grafana en:

```text
/etc/burger-danlin/production.env
```

Variables:

```text
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=<secreto-largo>
```

Levanta la pila:

```bash
docker compose \
  --env-file /etc/burger-danlin/production.env \
  -f docker-compose.prod.yml \
  --profile observability \
  up -d prometheus loki tempo alloy node-exporter grafana
```

Grafana escucha únicamente en:

```text
127.0.0.1:3001
```

Accede desde tu equipo con:

```bash
ssh -L 3001:127.0.0.1:3001 deploy@TU_VPS
```

Después abre `http://127.0.0.1:3001`.

Prometheus, Loki y Tempo no publican puertos al host. El endpoint `/api/v1/metrics` está bloqueado en el Nginx público y Prometheus lo consulta por la red privada de Docker.

Para tracing, una vez que el perfil de observabilidad esté arriba y Grafana muestre el datasource Tempo, habilita en `/etc/burger-danlin/production.env`:

```text
OTEL_TRACING_ENABLED=true
OTEL_SERVICE_NAME=burger-danlin-api
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://alloy:4318/v1/traces
OTEL_TRACE_SAMPLE_RATIO=1
```

Reinicia únicamente la API y genera tráfico. Las respuestas trazadas incluyen `X-Trace-Id`, que debe aparecer también en el log HTTP y en Tempo. Si el volumen aumenta, reduce `OTEL_TRACE_SAMPLE_RATIO` después de medir consumo real.

Consulta:

```text
deploy/observability/README.md
```

## 10. Nginx y TLS

Usa:

```text
deploy/nginx/burger-danlin.conf.example
```

como base.

Nginx es el único componente que debe escuchar públicamente en HTTP/HTTPS.

El API y Web permanecen en loopback.

Configura certificados reales antes de producción y valida:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 11. Backup manual inicial

Antes de activar automatización:

```bash
docker compose \
  --env-file /etc/burger-danlin/production.env \
  -f docker-compose.prod.yml \
  run --rm backup
```

Debe aparecer un par de archivos:

```text
burger-danlin-YYYYMMDDTHHMMSSZ.dump.age
burger-danlin-YYYYMMDDTHHMMSSZ.dump.age.sha256
```

Comprueba permisos:

```bash
sudo ls -lah /var/backups/burger-danlin
```

Nunca debe quedar un archivo `.dump` sin cifrar en:

```text
/var/backups/burger-danlin
```

El proceso utiliza archivos temporales dentro de `/tmp` y cifra el dump antes de moverlo al directorio final.

## 12. Restore drill inicial

```bash
docker compose \
  --env-file /etc/burger-danlin/production.env \
  -f docker-compose.prod.yml \
  --profile dr run --rm restore-drill
```

Debe terminar con:

```text
Restore drill succeeded.
```

Después limpia la DB temporal si quedó creada:

```bash
docker compose \
  --env-file /etc/burger-danlin/production.env \
  -f docker-compose.prod.yml \
  --profile dr rm -sf restore-postgres
```

## 13. Activar timers

```bash
sudo cp \
  deploy/systemd/burger-danlin-backup.service \
  /etc/systemd/system/

sudo cp \
  deploy/systemd/burger-danlin-backup.timer \
  /etc/systemd/system/

sudo cp \
  deploy/systemd/burger-danlin-restore-drill.service \
  /etc/systemd/system/

sudo cp \
  deploy/systemd/burger-danlin-restore-drill.timer \
  /etc/systemd/system/

sudo cp \
  deploy/systemd/burger-danlin-retention-cleanup.service \
  /etc/systemd/system/

sudo cp \
  deploy/systemd/burger-danlin-retention-cleanup.timer \
  /etc/systemd/system/

sudo cp \
  deploy/systemd/burger-danlin-group-delivery-settlement.service \
  /etc/systemd/system/

sudo cp \
  deploy/systemd/burger-danlin-group-delivery-settlement.timer \
  /etc/systemd/system/
```

Recarga systemd:

```bash
sudo systemctl daemon-reload
```

Activa primero backup y restore:

```bash
sudo systemctl enable --now burger-danlin-backup.timer
sudo systemctl enable --now burger-danlin-restore-drill.timer
sudo systemctl enable --now burger-danlin-group-delivery-settlement.timer
```

Antes de activar retención, deja `RETENTION_CLEANUP_ENABLED=false` y ejecuta un dry-run:

```bash
docker compose \
  --env-file /etc/burger-danlin/production.env \
  -f docker-compose.prod.yml \
  run --rm retention-cleanup \
  node dist/scripts/retention-cleanup.js
```

Revisa el JSON, valida los plazos legales/fiscales y después cambia:

```text
RETENTION_CLEANUP_ENABLED=true
```

Ejecuta una aplicación manual controlada:

```bash
docker compose \
  --env-file /etc/burger-danlin/production.env \
  -f docker-compose.prod.yml \
  run --rm retention-cleanup
```

Solo después habilita el timer diario:

```bash
sudo systemctl enable --now burger-danlin-retention-cleanup.timer
```

Comprueba calendarios:

```bash
systemctl list-timers 'burger-danlin-*'
```

Baseline incluido:

- backup local + copia offsite cada hora;
- restore drill el primer domingo de cada mes;
- retention cleanup diario a las 03:40 con retraso aleatorio de hasta 15 minutos;
- cierre/finalización de entregas grupales cada minuto. El job cancela pedidos sin pagar, libera sus reservas y congela el cargo final de envío de cada pedido pagado.

Objetivos técnicos iniciales:

- RPO: `<= 1 hora` para PostgreSQL, sujeto a que la copia offsite finalice correctamente;
- RTO: `<= 4 horas` para recuperar el servicio completo, pendiente de validar con un simulacro de pérdida total del VPS.

Son objetivos operativos y deben validarse con evidencia real.

## 14. Respuesta a incidentes

Los procedimientos operativos de seguridad están versionados en:

```text
deploy/runbooks/README.md
```

Incluyen cuenta/Admin comprometida, filtración de secretos, exposición de PostgreSQL, supply chain comprometida y DDoS/caída operativa.

Los nombres, teléfonos y canales privados de respuesta deben mantenerse fuera de Git. Antes del go-live se debe asignar Incident Lead, Technical Lead y Business/Privacy Contact, y ejecutar al menos un tabletop.

## 15. Logs

Logs de aplicación:

```bash
docker compose \
  --env-file /etc/burger-danlin/production.env \
  -f docker-compose.prod.yml \
  logs --tail=200 api web postgres redis
```

Logs de backup:

```bash
journalctl -u burger-danlin-backup.service
```

Logs del restore drill:

```bash
journalctl -u burger-danlin-restore-drill.service
```

Logs de retención:

```bash
journalctl -u burger-danlin-retention-cleanup.service
```

Logs de cierre grupal:

```bash
journalctl -u burger-danlin-group-delivery-settlement.service
```

Prueba manual del cierre automático:

```bash
docker compose \
  --env-file /etc/burger-danlin/production.env \
  -f docker-compose.prod.yml \
  run --rm group-delivery-settlement
```

Docker aplica rotación local de logs para evitar crecimiento ilimitado.

No deben imprimirse en logs:

- contraseñas;
- tokens;
- claves privadas;
- `DATABASE_URL` completas;
- secretos JWT;
- claves MFA;
- claves `age`.

## 16. Backup offsite inmutable

Configura un bucket IONOS Object Storage dedicado con:

- Versioning;
- Object Lock;
- retención por defecto.

Consulta:

```text
deploy/OFFSITE_BACKUP.md
```

Prueba el upload:

```bash
docker compose \
  --env-file /etc/burger-danlin/production.env \
  -f docker-compose.prod.yml \
  run --rm offsite-upload
```

Después prueba la recuperación desde Object Storage:

```bash
docker compose \
  --env-file /etc/burger-danlin/production.env \
  -f docker-compose.prod.yml \
  --profile dr run --rm offsite-fetch
```

No consideres DR completo hasta hacer un restore drill con un archivo descargado desde la copia offsite.

## 17. Preflight del VPS

Antes de abrir tráfico:

```bash
cd /opt/burger-danlin

sudo COMPOSE_FILE=/opt/burger-danlin/docker-compose.prod.yml \
  ENV_FILE=/etc/burger-danlin/production.env \
  sh deploy/vps/preflight.sh
```

El preflight comprueba como mínimo:

- Docker y Compose;
- configuración Nginx;
- permisos del archivo de secretos;
- resolución del Compose de producción;
- ausencia de PostgreSQL y Redis en interfaces públicas.

También conviene comprobar los permisos del directorio de backups:

```bash
sudo stat /var/backups/burger-danlin
```

El propietario esperado debe corresponder a:

```text
UID 10001
GID 10001
```

## 18. TLS y DNS

Antes de solicitar certificados:

1. apunta los DNS de Web/API al VPS;
2. confirma que los puertos 80/443 estén accesibles;
3. instala la configuración Nginx con los dominios reales;
4. emite certificados con tu cliente ACME/Let's Encrypt;
5. ejecuta `nginx -t`;
6. recarga Nginx;
7. comprueba HTTPS desde una red externa.

No expongas públicamente:

```text
3000
4000
5432
6379
```

Web/API permanecen en loopback y Nginx es el punto de entrada público.

## 19. Verificación del usuario de backups

Después de construir la imagen puedes verificar que no corre como root:

```bash
docker run --rm \
  burger-danlin-backup \
  -c "id"
```

La salida esperada es similar a:

```text
uid=10001(backup) gid=10001(backup)
```

No debe aparecer:

```text
uid=0(root)
```

El uso de:

```text
--user 0:0
```

queda reservado únicamente para operaciones administrativas explícitas como la creación inicial de:

```text
/etc/burger-danlin/backup-age.key
```

Los backups normales, restauraciones y operaciones offsite deben utilizar el usuario no-root configurado en la imagen.