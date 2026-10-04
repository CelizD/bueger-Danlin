# Política de migraciones de base de datos

Esta política define cómo se realizan cambios de esquema y datos en producción para **Burger Danlin**.

El objetivo es evitar despliegues donde una versión nueva de la aplicación deje de ser compatible con la base existente, o donde una migración destructiva impida volver temporalmente a la versión anterior del código.

## Principio general

Los cambios de base de datos se realizan siguiendo el patrón:

```text
EXPAND → MIGRATE → CONTRACT
```

Por defecto, una migración de producción debe ser **compatible hacia atrás** con la versión de la aplicación que estaba desplegada inmediatamente antes.

Los cambios destructivos no deben combinarse en el mismo despliegue que introduce su reemplazo.

## 1. EXPAND

Primero se amplía el esquema sin eliminar aquello que usa la versión actual.

Ejemplos permitidos:

- agregar una tabla;
- agregar una columna nullable;
- agregar una columna con un valor por defecto seguro;
- agregar índices;
- agregar nuevas relaciones sin eliminar las anteriores;
- agregar constraints cuando los datos existentes ya cumplen la regla;
- agregar un nuevo campo que convivirá temporalmente con el anterior.

Durante esta fase:

1. La versión anterior de la aplicación debe seguir funcionando.
2. No se renombran ni eliminan columnas todavía utilizadas.
3. No se eliminan tablas todavía utilizadas.
4. No se estrecha un tipo de dato si puede romper registros existentes.
5. No se convierte una columna a `NOT NULL` hasta comprobar que no existen valores `NULL`.
6. Si se reemplaza una columna, la aplicación debe poder convivir temporalmente con ambas.

Ejemplo:

En lugar de hacer directamente:

```sql
ALTER TABLE "Customer"
RENAME COLUMN "phone" TO "phoneE164";
```

se debe preferir inicialmente:

```text
1. agregar phoneE164;
2. desplegar código capaz de escribir/leer el nuevo campo;
3. migrar datos existentes;
4. comprobar que ya no se depende de phone;
5. eliminar phone en una release posterior.
```

## 2. MIGRATE

Después del cambio aditivo se migran los datos y el comportamiento de la aplicación.

Esta fase puede incluir:

- backfill de columnas nuevas;
- copia de datos de una estructura antigua a una nueva;
- dual-write temporal cuando sea necesario;
- cambio gradual de lecturas al campo nuevo;
- validación de nuevos constraints;
- corrección de datos antiguos antes de endurecer el esquema.

### Reglas para backfills

Los backfills deben ser:

- repetibles o idempotentes cuando sea posible;
- acotados por lotes si el volumen puede generar locks prolongados;
- observables;
- capaces de detenerse y reanudarse sin corromper datos;
- probados contra una copia o entorno de staging cuando el riesgo sea significativo.

No se debe incluir una actualización masiva costosa dentro de una migración de esquema sin evaluar previamente duración y locking.

Para operaciones grandes se prefiere:

1. aplicar primero el cambio de esquema;
2. desplegar la aplicación compatible;
3. ejecutar un script de backfill controlado;
4. verificar conteos/invariantes;
5. continuar con Contract en otra release.

## 3. CONTRACT

Solo después de demostrar que la aplicación ya no depende de la estructura anterior se permite retirar lo obsoleto.

Ejemplos:

- eliminar una columna antigua;
- eliminar una tabla antigua;
- eliminar índices ya innecesarios;
- endurecer una columna a `NOT NULL`;
- retirar código de dual-read/dual-write;
- eliminar compatibilidad temporal.

Contract debe realizarse en un **despliegue separado** de Expand cuando el cambio afecte datos o compatibilidad de versiones.

Antes de Contract se debe comprobar:

- que el código desplegado ya no usa el objeto a eliminar;
- que los datos ya fueron migrados;
- que CI está verde;
- que existe backup reciente;
- que la release anterior no será necesaria para un rollback normal del código;
- que el cambio fue probado en staging cuando sea de riesgo relevante.

## Prisma

### Desarrollo local

Para crear nuevas migraciones se puede utilizar:

```bash
pnpm db:migrate
```

que ejecuta:

```text
prisma migrate dev
```

Esto es únicamente para desarrollo.

Antes de hacer commit se debe revisar manualmente el SQL generado en:

```text
database/prisma/migrations/
```

No se debe asumir que el SQL generado automáticamente es seguro para producción.

### Producción

En producción únicamente se utiliza:

```text
prisma migrate deploy
```

En Burger Danlin se ejecuta mediante:

```bash
docker compose \
  --env-file /etc/burger-danlin/production.env \
  -f docker-compose.prod.yml \
  run --rm migrate
```

El servicio `migrate` utiliza la identidad administrativa de PostgreSQL. La API utiliza un usuario runtime de menor privilegio y no debe ejecutar DDL.

Nunca ejecutar en producción:

```text
prisma migrate dev
prisma db push
```

## Migraciones ya aplicadas

Una migración que ya fue aplicada en producción es **inmutable**.

No se debe:

- editar su `migration.sql`;
- cambiar su nombre;
- borrarla del historial;
- reescribirla para corregir un fallo posterior.

La corrección se realiza mediante una **nueva migración**.

Esto mantiene coherente `_prisma_migrations` entre entornos.

## Cambios destructivos

Se consideran de riesgo alto, entre otros:

- `DROP TABLE`;
- `DROP COLUMN`;
- cambios de tipo con pérdida potencial;
- renombres utilizados por una versión aún desplegable;
- `NOT NULL` sobre datos no verificados;
- eliminación de valores enum utilizados;
- operaciones que reescriban grandes cantidades de filas;
- operaciones con locks prolongados.

Estos cambios requieren una justificación explícita en el PR y deben indicar por qué es seguro ejecutar Contract.

## Constraints

Para agregar un nuevo `CHECK`, `UNIQUE`, FK o `NOT NULL`:

1. validar primero los datos existentes;
2. corregir datos inválidos antes del endurecimiento;
3. aplicar el constraint;
4. comprobarlo en CI/staging;
5. monitorear errores después del despliegue.

Los constraints de dominio existentes en Burger Danlin son verificados automáticamente en CI después de `prisma migrate deploy`.

## Orden de despliegue

Para un cambio normal Expand:

```text
1. backup reciente
2. build de imágenes
3. levantar PostgreSQL
4. db-bootstrap
5. prisma migrate deploy
6. desplegar API/Web compatibles
7. health/readiness
8. smoke test
9. monitoreo
```

Para una evolución que requiera las tres fases:

```text
Release A
  Expand
  ↓
  app compatible con esquema antiguo + nuevo

Backfill / transición
  Migrate
  ↓
  validar datos y cambiar lecturas/escrituras

Release B o posterior
  Contract
  ↓
  retirar estructura antigua
```

## Rollback y forward recovery

El rollback normal debe ser principalmente del **código**, por eso Expand debe mantener compatibilidad con la versión anterior.

No se debe intentar revertir automáticamente una migración destructiva con SQL improvisado.

Ante un fallo:

1. detener el despliegue;
2. evaluar si la base sigue siendo compatible con la release anterior;
3. si lo es, volver temporalmente al código anterior;
4. corregir el problema mediante una nueva migración o forward fix;
5. usar restauración de backup solo cuando exista pérdida/corrupción que lo justifique.

`prisma migrate resolve` no es un mecanismo normal de rollback. Solo debe usarse para recuperación operativa consciente cuando el estado real de la base y el historial de Prisma hayan sido verificados.

## Requisitos de Pull Request

Un PR que modifique:

```text
database/prisma/schema.prisma
database/prisma/migrations/**
```

debe indicar:

- fase: Expand, Migrate o Contract;
- compatibilidad con la versión anterior;
- si cambia o transforma datos existentes;
- riesgo de locks o duración;
- estrategia de backfill si aplica;
- estrategia de rollback/forward recovery;
- evidencia de CI;
- necesidad de staging o ventana de mantenimiento.

Los cambios Contract deben explicar explícitamente qué evidencia demuestra que la estructura anterior ya no se utiliza.

## CI

El pipeline debe continuar verificando como mínimo:

1. generación del Prisma Client;
2. `prisma migrate deploy` contra PostgreSQL limpio;
3. constraints de dominio;
4. typecheck/lint;
5. tests;
6. build;
7. pruebas integradas.

Una migración que no puede aplicarse desde cero en CI no se considera lista para producción.

## Go-live

Antes de aplicar migraciones productivas:

- confirmar backup reciente;
- revisar el SQL pendiente;
- confirmar que la release respeta esta política;
- ejecutar primero en staging cuando el cambio sea de riesgo relevante;
- aplicar migraciones antes de arrancar código que dependa del nuevo esquema;
- comprobar `/health/ready` después del despliegue;
- revisar logs y métricas.

## Emergencias

Una migración urgente sigue estando sujeta a:

- revisión del SQL;
- backup;
- registro del motivo;
- nueva migración versionada;
- validación posterior;
- no editar migraciones históricas.

La urgencia puede reducir el tiempo del proceso, pero no elimina el historial ni las garantías de integridad.
