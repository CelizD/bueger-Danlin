# Disaster Recovery — Burger Danlin

Este documento describe el estado operativo de backup/restore. No define por sí solo un SLA contractual.

## Objetivos RPO/RTO

Pendientes de aprobación según impacto real del negocio:

- **RPO objetivo:** TODO
- **RTO objetivo:** TODO

La configuración incluida hace un backup cada 6 horas como baseline operativo inicial. Eso no equivale por sí solo a prometer un RPO de 6 horas: el RPO real depende de que el timer, almacenamiento, cifrado, copia externa y restore funcionen correctamente.

El restore drill mensual mide si el backup puede descifrarse y restaurarse correctamente, pero el RTO formal debe medirse y aprobarse con una prueba completa de recuperación del servicio.

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

## Gap pendiente: copia aislada/offsite

Los backups locales cifrados protegen contra lectura accidental del archivo, pero no bastan frente a:

- pérdida completa del VPS;
- borrado administrativo;
- ransomware que alcance el mismo host/disco.

Antes de lanzamiento debe configurarse una segunda copia cifrada en almacenamiento independiente, idealmente con versionado/retención inmutable.

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
