# Migrar un volumen PostgreSQL existente al rol runtime mínimo

Este procedimiento aplica únicamente si el volumen ya fue inicializado con la configuración anterior, donde el usuario de la API también era propietario o superusuario de PostgreSQL.

No borres el volumen si contiene datos que quieras conservar.

## 1. Haz un backup antes de cambiar roles

Usa el procedimiento de backup actual y verifica que el archivo cifrado y su checksum existan.

## 2. Detén Web y API

Con la versión anterior del Compose todavía disponible:

```bash
docker compose \
  --env-file /etc/burger-danlin/production.env \
  -f docker-compose.prod.yml \
  stop web api
```

## 3. Crea un nuevo rol administrativo

Entra a PostgreSQL con el superusuario actual:

```bash
docker compose \
  --env-file /etc/burger-danlin/production.env \
  -f docker-compose.prod.yml \
  exec postgres sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Dentro de `psql`, sustituye los valores por los definitivos:

```sql
CREATE ROLE burger_admin
  WITH LOGIN SUPERUSER CREATEDB CREATEROLE
  PASSWORD 'CONTRASENA_ADMIN_NUEVA_Y_LARGA';

REASSIGN OWNED BY burger_runtime TO burger_admin;
ALTER DATABASE burger_danlin OWNER TO burger_admin;
ALTER SCHEMA public OWNER TO burger_admin;
```

Si el antiguo superusuario no se llamaba `burger_runtime`, usa su nombre real en `REASSIGN OWNED BY`.

Sal con:

```text
\q
```

## 4. Actualiza production.env

```dotenv
POSTGRES_DB=burger_danlin
POSTGRES_ADMIN_USER=burger_admin
POSTGRES_ADMIN_PASSWORD=CONTRASENA_ADMIN_NUEVA_Y_LARGA
POSTGRES_RUNTIME_USER=burger_runtime
POSTGRES_RUNTIME_PASSWORD=CONTRASENA_RUNTIME_NUEVA_Y_DISTINTA
```

Las contraseñas admin/runtime deben ser distintas.

## 5. Ejecuta el bootstrap

Con la nueva versión del Compose:

```bash
docker compose \
  --env-file /etc/burger-danlin/production.env \
  -f docker-compose.prod.yml \
  up -d postgres

docker compose \
  --env-file /etc/burger-danlin/production.env \
  -f docker-compose.prod.yml \
  run --rm db-bootstrap
```

El bootstrap:

- fuerza `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOREPLICATION` y `NOBYPASSRLS`;
- elimina membresías heredadas del rol runtime;
- revoca `CREATE` de `PUBLIC` en el esquema de la aplicación;
- concede solo `CONNECT`, `USAGE` y DML sobre tablas/secuencias;
- configura privilegios por defecto para objetos creados por el rol admin;
- falla si runtime todavía es propietario de la base, esquema o tablas.

## 6. Ejecuta migraciones y revalida

```bash
docker compose \
  --env-file /etc/burger-danlin/production.env \
  -f docker-compose.prod.yml \
  run --rm migrate

docker compose \
  --env-file /etc/burger-danlin/production.env \
  -f docker-compose.prod.yml \
  run --rm db-bootstrap
```

La segunda ejecución aplica y verifica permisos sobre cualquier objeto nuevo.

Después levanta API/Web y comprueba `/health/ready`.

## 7. Verificación manual opcional

Conectado como runtime, esto debe funcionar:

```sql
SELECT count(*) FROM "Order";
```

Y estas operaciones deben fallar:

```sql
CREATE TABLE should_fail(id integer);
CREATE ROLE should_fail_login LOGIN;
```
