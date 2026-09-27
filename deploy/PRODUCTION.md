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

En producción, `PAYMENT_PROVIDER` debe ser exactamente `stripe` o `mercadopago`. El valor `mock` está reservado para desarrollo y pruebas; si se configura `mock`, un valor vacío o un proveedor desconocido con `NODE_ENV=production`, la API rechazará el arranque. Configura también los secretos del proveedor seleccionado antes de desplegar.

`ENABLE_REAL_PAYMENTS` es un kill switch adicional y debe permanecer en `false` hasta completar y validar sandbox, webhooks firmados, reconciliación, reembolsos y pruebas end-to-end. Mientras no sea exactamente `true`, el backend bloquea el checkout real antes de persistir un intento de pago y el cliente HTTP vuelve a bloquear cualquier llamada saliente al proveedor. Tener credenciales configuradas no habilita pagos por sí solo.

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
```

en producción.

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

## 9. Nginx y TLS

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

## 10. Backup manual inicial

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

## 11. Restore drill inicial

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

## 12. Activar timers

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
```

Recarga systemd:

```bash
sudo systemctl daemon-reload
```

Activa los timers:

```bash
sudo systemctl enable --now burger-danlin-backup.timer
sudo systemctl enable --now burger-danlin-restore-drill.timer
```

Comprueba calendarios:

```bash
systemctl list-timers 'burger-danlin-*'
```

Baseline incluido:

- backup local + copia offsite cada hora;
- restore drill el primer domingo de cada mes.

Objetivos técnicos iniciales:

- RPO: `<= 1 hora` para PostgreSQL, sujeto a que la copia offsite finalice correctamente;
- RTO: `<= 4 horas` para recuperar el servicio completo, pendiente de validar con un simulacro de pérdida total del VPS.

Son objetivos operativos y deben validarse con evidencia real.

## 13. Logs

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

Docker aplica rotación local de logs para evitar crecimiento ilimitado.

No deben imprimirse en logs:

- contraseñas;
- tokens;
- claves privadas;
- `DATABASE_URL` completas;
- secretos JWT;
- claves MFA;
- claves `age`.

## 14. Backup offsite inmutable

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

## 15. Preflight del VPS

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

## 16. TLS y DNS

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

## 17. Verificación del usuario de backups

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