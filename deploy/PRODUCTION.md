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
sudo install -d -m 700 /var/backups/burger-danlin
sudo install -d -m 755 /opt/burger-danlin
```

El repositorio puede vivir en `/opt/burger-danlin`.

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

Para PostgreSQL/Redis usa contraseñas largas que no contengan caracteres que rompan una URL si se construye `DATABASE_URL`; base64url es una opción práctica.

## 3. Clave de backup age

Construye primero la utilidad:

```bash
cd /opt/burger-danlin
docker build -f deploy/backup/Dockerfile -t burger-danlin-backup .
```

Genera la identidad privada directamente en `/etc`:

```bash
sudo docker run --rm \
  -v /etc/burger-danlin:/keys \
  burger-danlin-backup \
  -c 'age-keygen -o /keys/backup-age.key'
sudo chmod 600 /etc/burger-danlin/backup-age.key
```

Obtén el recipient público:

```bash
sudo grep "^# public key:" /etc/burger-danlin/backup-age.key
```

Copia únicamente el valor `age1...` a `BACKUP_AGE_RECIPIENT` en `production.env`.

La clave privada nunca debe entrar a Git, variables del frontend ni logs.

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

## 6. Levantar PostgreSQL/Redis

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

No deben existir bindings públicos `0.0.0.0:5432` ni `0.0.0.0:6379`.

## 7. Migraciones

Antes de levantar una nueva versión del API:

```bash
docker compose \
  --env-file /etc/burger-danlin/production.env \
  -f docker-compose.prod.yml \
  run --rm migrate
```

En producción se usa `prisma migrate deploy`, no `migrate dev`.

## 8. Levantar aplicación

```bash
docker compose \
  --env-file /etc/burger-danlin/production.env \
  -f docker-compose.prod.yml \
  up -d api web
```

Verifica:

```bash
curl -fsS -H 'X-Forwarded-Proto: https' http://127.0.0.1:4000/api/v1/health/live
curl -fsS -H 'X-Forwarded-Proto: https' http://127.0.0.1:4000/api/v1/health/ready
curl -fsS http://127.0.0.1:3000/ >/dev/null
```

## 9. Nginx/TLS

Usa `deploy/nginx/burger-danlin.conf.example` como base.

Nginx es el único componente que debe escuchar públicamente en HTTP/HTTPS. El API y Web permanecen en loopback.

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

Nunca debe quedar un `.dump` sin cifrar en `/var/backups/burger-danlin`.

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
sudo cp deploy/systemd/burger-danlin-backup.service /etc/systemd/system/
sudo cp deploy/systemd/burger-danlin-backup.timer /etc/systemd/system/
sudo cp deploy/systemd/burger-danlin-restore-drill.service /etc/systemd/system/
sudo cp deploy/systemd/burger-danlin-restore-drill.timer /etc/systemd/system/

sudo systemctl daemon-reload
sudo systemctl enable --now burger-danlin-backup.timer
sudo systemctl enable --now burger-danlin-restore-drill.timer
```

Comprueba calendarios:

```bash
systemctl list-timers 'burger-danlin-*'
```

Baseline incluido:

- backup cada 6 horas;
- restore drill el primer domingo de cada mes.

Son frecuencias operativas iniciales, no RPO/RTO contractuales.

## 13. Logs

```bash
docker compose \
  --env-file /etc/burger-danlin/production.env \
  -f docker-compose.prod.yml \
  logs --tail=200 api web postgres redis

journalctl -u burger-danlin-backup.service
journalctl -u burger-danlin-restore-drill.service
```

Docker aplica rotación local de logs para evitar crecimiento ilimitado.

## 14. Gap obligatorio antes del lanzamiento

El backup local cifrado debe replicarse a otro sistema/ubicación antes de considerar DR completo.

Opciones válidas incluyen object storage separado con:

- cifrado;
- versionado;
- retención;
- credenciales de mínimo privilegio;
- idealmente inmutabilidad/WORM.

No guardes la única copia de backup en el mismo VPS que ejecuta producción.
