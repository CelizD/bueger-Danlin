#!/bin/sh
set -eu

required_vars="
POSTGRES_DB
POSTGRES_ADMIN_USER
POSTGRES_ADMIN_PASSWORD
POSTGRES_RUNTIME_USER
POSTGRES_RUNTIME_PASSWORD
"

for key in $required_vars; do
  eval "value=\${$key:-}"
  if [ -z "$value" ]; then
    echo "FAIL: $key is required" >&2
    exit 1
  fi
done

validate_identifier() {
  value="$1"
  label="$2"

  if ! printf '%s' "$value" | grep -Eq '^[A-Za-z_][A-Za-z0-9_]*$'; then
    echo "FAIL: $label must be a simple PostgreSQL identifier" >&2
    exit 1
  fi
}

validate_identifier "$POSTGRES_DB" "POSTGRES_DB"
validate_identifier "$POSTGRES_ADMIN_USER" "POSTGRES_ADMIN_USER"
validate_identifier "$POSTGRES_RUNTIME_USER" "POSTGRES_RUNTIME_USER"

if [ "$POSTGRES_ADMIN_USER" = "$POSTGRES_RUNTIME_USER" ]; then
  echo "FAIL: admin and runtime PostgreSQL roles must be different" >&2
  exit 1
fi

export PGPASSWORD="$POSTGRES_ADMIN_PASSWORD"

psql \
  --host=postgres \
  --port=5432 \
  --username="$POSTGRES_ADMIN_USER" \
  --dbname="$POSTGRES_DB" \
  --set=ON_ERROR_STOP=1 \
  --set=runtime_user="$POSTGRES_RUNTIME_USER" \
  --set=runtime_password="$POSTGRES_RUNTIME_PASSWORD" \
  --set=admin_user="$POSTGRES_ADMIN_USER" <<'SQL'
SELECT format(
  'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',
  :'runtime_user',
  :'runtime_password'
)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_roles WHERE rolname = :'runtime_user'
) \gexec

SELECT format(
  'ALTER ROLE %I WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',
  :'runtime_user',
  :'runtime_password'
) \gexec

SELECT format(
  'REVOKE %I FROM %I',
  parent.rolname,
  member.rolname
)
FROM pg_auth_members membership
JOIN pg_roles parent ON parent.oid = membership.roleid
JOIN pg_roles member ON member.oid = membership.member
WHERE member.rolname = :'runtime_user' \gexec

REVOKE CREATE ON SCHEMA public FROM PUBLIC;

SELECT format(
  'REVOKE ALL PRIVILEGES ON DATABASE %I FROM %I',
  current_database(),
  :'runtime_user'
) \gexec

SELECT format(
  'GRANT CONNECT ON DATABASE %I TO %I',
  current_database(),
  :'runtime_user'
) \gexec

SELECT format(
  'REVOKE CREATE ON SCHEMA public FROM %I',
  :'runtime_user'
) \gexec

SELECT format(
  'GRANT USAGE ON SCHEMA public TO %I',
  :'runtime_user'
) \gexec

SELECT format(
  'REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM %I',
  :'runtime_user'
) \gexec

SELECT format(
  'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %I',
  :'runtime_user'
) \gexec

SELECT format(
  'REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM %I',
  :'runtime_user'
) \gexec

SELECT format(
  'GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO %I',
  :'runtime_user'
) \gexec

SELECT format(
  'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I',
  :'admin_user',
  :'runtime_user'
) \gexec

SELECT format(
  'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO %I',
  :'admin_user',
  :'runtime_user'
) \gexec
SQL

owned_objects="$(
  psql \
    --host=postgres \
    --port=5432 \
    --username="$POSTGRES_ADMIN_USER" \
    --dbname="$POSTGRES_DB" \
    --tuples-only \
    --no-align \
    --set=ON_ERROR_STOP=1 \
    --set=runtime_user="$POSTGRES_RUNTIME_USER" \
    --command="
      SELECT
        (SELECT count(*) FROM pg_database
          WHERE datname = current_database()
            AND pg_get_userbyid(datdba) = '$POSTGRES_RUNTIME_USER')
        +
        (SELECT count(*) FROM pg_namespace
          WHERE nspname = 'public'
            AND pg_get_userbyid(nspowner) = '$POSTGRES_RUNTIME_USER')
        +
        (SELECT count(*) FROM pg_class
          WHERE relnamespace = 'public'::regnamespace
            AND relkind IN ('r','p','S','v','m','f')
            AND pg_get_userbyid(relowner) = '$POSTGRES_RUNTIME_USER');
    "
)"

if [ "${owned_objects:-0}" -ne 0 ]; then
  echo "FAIL: runtime role still owns database/schema objects; reassign ownership to the admin role before starting the API" >&2
  echo "See deploy/postgres/MIGRATE_EXISTING_VOLUME.md" >&2
  exit 1
fi

role_violations="$(
  psql \
    --host=postgres \
    --port=5432 \
    --username="$POSTGRES_ADMIN_USER" \
    --dbname="$POSTGRES_DB" \
    --tuples-only \
    --no-align \
    --set=ON_ERROR_STOP=1 \
    --set=runtime_user="$POSTGRES_RUNTIME_USER" \
    --command="
      SELECT count(*)
      FROM pg_roles
      WHERE rolname = '$POSTGRES_RUNTIME_USER'
        AND (
          rolsuper
          OR rolcreatedb
          OR rolcreaterole
          OR rolreplication
          OR rolbypassrls
          OR NOT rolcanlogin
        );
    "
)"

if [ "${role_violations:-1}" -ne 0 ]; then
  echo "FAIL: runtime role still has forbidden PostgreSQL attributes" >&2
  exit 1
fi

membership_count="$(
  psql \
    --host=postgres \
    --port=5432 \
    --username="$POSTGRES_ADMIN_USER" \
    --dbname="$POSTGRES_DB" \
    --tuples-only \
    --no-align \
    --set=ON_ERROR_STOP=1 \
    --set=runtime_user="$POSTGRES_RUNTIME_USER" \
    --command="
      SELECT count(*)
      FROM pg_auth_members membership
      JOIN pg_roles member ON member.oid = membership.member
      WHERE member.rolname = '$POSTGRES_RUNTIME_USER';
    "
)"

if [ "${membership_count:-1}" -ne 0 ]; then
  echo "FAIL: runtime role still inherits another PostgreSQL role" >&2
  exit 1
fi

schema_create="$(
  psql \
    --host=postgres \
    --port=5432 \
    --username="$POSTGRES_ADMIN_USER" \
    --dbname="$POSTGRES_DB" \
    --tuples-only \
    --no-align \
    --set=ON_ERROR_STOP=1 \
    --set=runtime_user="$POSTGRES_RUNTIME_USER" \
    --command="
      SELECT has_schema_privilege('$POSTGRES_RUNTIME_USER', 'public', 'CREATE');
    "
)"

if [ "${schema_create}" != "f" ]; then
  echo "FAIL: runtime role can still CREATE objects in schema public" >&2
  exit 1
fi

echo "PostgreSQL runtime role verified: login-only, no admin attributes, no inherited roles, no object ownership, DML-only schema access."
