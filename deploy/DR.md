# Disaster Recovery — Burger Danlin

Este documento describe el estado operativo de backup/restore. No define por sí solo un SLA contractual.

## Objetivos RPO/RTO

Objetivos técnicos iniciales para lanzamiento:

- **RPO objetivo:** <= 1 hora para PostgreSQL.
- **RTO objetivo:** <= 4 horas para recuperar el servicio completo en un VPS nuevo.

El timer inicia un ciclo de backup cada hora. Cada ciclo crea primero el backup local cifrado y después intenta copiarlo al almacenamiento offsite. El RPO solo se considera cumplido cuando la copia offsite termina correctamente.

Estos son objetivos operativos, no garantías contractuales. Deben validarse con evidencia real. El restore drill mensual valida la integridad del dump; el RTO de 4 horas requiere además un simulacro de recuperación completa del VPS, incluyendo infraestructura, secretos, base de datos, aplicación, Nginx, TLS y DNS.

## Backup

El servicio `backup`:

1. ejecuta `pg_dump` en formato custom;
2. escribe el dump temporal solo dentro del contenedor;
3. cifra con `age` usando un recipient público;
4. guarda únicamente `.dump.age` en el directorio persistente;
5. genera SHA-256 del archivo cifrado;
6. elimina backups locales que excedan `BACKUP_RETENTION_DAYS`.

La clave privada de `age` no se necesita para crear backups.

## Restore drill

El perfil `dr` crea una PostgreSQL temporal y aislada.

`restore-drill`:

1. toma el backup cifrado más reciente, o `BACKUP_FILE` si se indica;
2. valida SHA-256;
3. descifra a almacenamiento temporal;
4. valida el archivo mediante `pg_restore --list`;
5. restaura en la DB temporal;
6. comprueba que existan tablas públicas y `_prisma_migrations`;
7. termina con error si cualquiera de esos pasos falla.

No modifica la base de producción.

## Restore real

`deploy/backup/restore.sh` es destructivo y exige:

```text
CONFIRM_DESTRUCTIVE_RESTORE=RESTORE
```

No debe ejecutarse contra producción sin:

- snapshot/backup actual verificado;
- aprobación del responsable;
- ventana de mantenimiento;
- verificación del destino;
- plan de rollback/forward recovery.

## Copia aislada/offsite

El repositorio incluye un flujo S3-compatible pensado para IONOS Object Storage:

1. el bucket debe tener Versioning habilitado;
2. Object Lock debe estar habilitado;
3. debe existir una retención por defecto en modo GOVERNANCE o COMPLIANCE;
4. `offsite-upload` se niega a subir si esas condiciones no se cumplen;
5. se suben el `.dump.age` y su `.sha256`;
6. se valida el tamaño del objeto remoto;
7. `offsite-fetch` permite recuperar la copia cifrada si el VPS local se pierde.

El bucket, claves y retención se configuran fuera de Git. La verificación real del bucket offsite sigue siendo obligatoria antes del lanzamiento.

## Evidencia que conservar

Por cada drill:

- fecha/hora;
- backup utilizado;
- tamaño;
- resultado;
- duración total;
- incidentes/errores;
- RPO observado;
- RTO observado.

Los logs de systemd pueden consultarse con:

```bash
journalctl -u burger-danlin-backup.service
journalctl -u burger-danlin-restore-drill.service
```
