# Backup offsite inmutable — IONOS Object Storage

Burger Danlin guarda primero un backup PostgreSQL cifrado con `age` y después copia ese archivo cifrado a un bucket S3-compatible independiente del VPS.

## Arquitectura

```text
PostgreSQL
    |
    v
pg_dump
    |
    v
age encryption
    |
    +--> /var/backups/burger-danlin      (copia local)
    |
    +--> IONOS Object Storage            (copia offsite)
             |
             +-- Versioning
             +-- Object Lock
             +-- retención por defecto
```

La clave privada de `age` debe almacenarse fuera del repositorio y, para recuperación ante pérdida total del VPS, debe existir al menos otra copia segura de esa identidad.

## 1. Crear un bucket dedicado

Usa un bucket exclusivo para backups de Burger Danlin.

Al crear el bucket:

- habilita Object Lock desde el principio;
- confirma que Versioning queda habilitado;
- mantén el bucket privado;
- configura una retención por defecto.

No reutilices un bucket público ni uno destinado a assets del sitio.

### Modo de Object Lock

Para la etapa de validación se puede usar:

```text
GOVERNANCE
30 días
```

Cuando el proceso de backup, restore y retención esté validado y se desee una política que administradores tampoco puedan saltarse durante la retención, evalúa cambiar el diseño operativo a un bucket creado/configurado para:

```text
COMPLIANCE
30 días o la retención aprobada por negocio
```

No cambies a COMPLIANCE sin entender primero su efecto sobre borrado y retención.

## 2. Endpoint y región

Obtén el endpoint exacto desde IONOS Object Storage.

Ejemplo de forma:

```text
https://s3.<region>.ionoscloud.com
```

No copies un endpoint de ejemplo sin confirmar la región real del bucket.

## 3. Credenciales dedicadas

Crea credenciales exclusivas para el proceso de backup.

No uses:

- credenciales personales;
- claves del frontend;
- credenciales de PostgreSQL;
- credenciales de Stripe/Mercado Pago.

Aplica mínimo privilegio al bucket de backup. La cuenta usada para subir backups no necesita administrar otros buckets de la organización.

Las claves se guardan únicamente en:

```text
/etc/burger-danlin/production.env
```

con permisos:

```bash
chmod 600 /etc/burger-danlin/production.env
```

## 4. Variables

Configura:

```text
S3_ENDPOINT_URL=
S3_REGION=
S3_BUCKET=
S3_PREFIX=burger-danlin/postgres
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
```

## 5. Verificar bucket

El contenedor ejecuta automáticamente `offsite-verify.sh` antes de cada upload.

Debe comprobar:

```text
Versioning: Enabled
Object Lock: Enabled
Default retention: presente
Mode: GOVERNANCE o COMPLIANCE
```

Prueba manual:

```bash
docker compose \
  --env-file /etc/burger-danlin/production.env \
  -f docker-compose.prod.yml \
  run --rm offsite-upload
```

Si Versioning/Object Lock/retención no están correctamente configurados, el comando debe fallar.

## 6. Backup automático

`burger-danlin-backup.service` ejecuta en orden:

```text
backup local cifrado
        |
        v
offsite-upload
        |
        v
verificación remota
```

Si falla el backup local, no intenta subir.

Si el backup local funciona pero la copia offsite falla, la unidad systemd queda fallida para que el incidente sea visible.

El timer inicia un ciclo cada hora.

## 7. Verificar objetos remotos

Cada ciclo sube:

```text
burger-danlin-YYYYMMDDTHHMMSSZ.dump.age
burger-danlin-YYYYMMDDTHHMMSSZ.dump.age.sha256
```

El uploader:

1. valida primero el SHA-256 local;
2. sube ambos objetos;
3. consulta el objeto remoto;
4. compara el tamaño remoto con el local.

## 8. Recuperar si el VPS se pierde

En un servidor nuevo, con el mismo bucket y credenciales:

```bash
docker compose \
  --env-file /etc/burger-danlin/production.env \
  -f docker-compose.prod.yml \
  --profile dr run --rm offsite-fetch
```

El comando descarga el backup más reciente y su checksum en:

```text
/backups/offsite-recovery/
```

y comprueba SHA-256.

Después puede probarse el archivo recuperado contra la PostgreSQL temporal:

```bash
export BACKUP_FILE="offsite-recovery/<archivo>.dump.age"

docker compose \
  --env-file /etc/burger-danlin/production.env \
  -f docker-compose.prod.yml \
  --profile dr run --rm restore-drill
```

## 9. Protección de la clave age

Object Lock protege el backup remoto contra cambios/borrado, pero el dump sigue cifrado con `age`.

La identidad privada:

```text
backup-age.key
```

no debe existir únicamente en el VPS.

Mantén una segunda copia segura fuera del servidor. Sin esa identidad, un backup `.dump.age` no podrá descifrarse.

## 10. Evidencia de lanzamiento

Antes de marcar offsite como completo conserva evidencia de:

- bucket privado;
- Versioning Enabled;
- Object Lock Enabled;
- modo de retención;
- periodo de retención;
- upload real correcto;
- existencia remota de `.dump.age` y `.sha256`;
- descarga desde Object Storage;
- SHA-256 correcto tras descarga;
- restore drill usando el archivo descargado desde Object Storage.
