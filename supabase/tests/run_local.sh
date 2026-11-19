#!/usr/bin/env bash
# Spin up a throwaway local PostgreSQL, apply the HerbHub migrations with a small
# Supabase-style auth shim, and run the row-level-security tests. No cloud needed.
#
# Requires PostgreSQL (tested with 16) and runs the server as the `postgres`
# system user (Postgres refuses to run as root). Usage:  sudo ./run_local.sh
set -euo pipefail

PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
HERE="$(cd "$(dirname "$0")/../.." && pwd)"          # repo root
WORK="$(mktemp -d /var/lib/postgresql/hhtest.XXXXXX)"
DATA="$WORK/data"; SOCK="$WORK/sock"; PORT="${PORT:-5433}"
mkdir -p "$DATA" "$SOCK"
cp "$HERE"/supabase/migrations/*_core_schema.sql "$WORK/mig.sql"
cp "$HERE"/supabase/tests/rls_security_test.sql  "$WORK/test.sql"
chown -R postgres:postgres "$WORK"

cleanup(){ su postgres -c "$PGBIN/pg_ctl -D '$DATA' stop" >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

su postgres -c "$PGBIN/initdb -D '$DATA' -U postgres --auth=trust" >/dev/null
su postgres -c "$PGBIN/postgres -D '$DATA' -k '$SOCK' -p $PORT -c listen_addresses=''" >"$WORK/pg.log" 2>&1 &
for _ in $(seq 1 20); do [ -S "$SOCK/.s.PGSQL.$PORT" ] && break; sleep 1; done

Q(){ su postgres -c "psql -h '$SOCK' -p $PORT -U postgres -d postgres $1"; }

# Supabase-style stubs so the migration and tests run outside Supabase.
Q "-q -c \"create schema auth; create schema storage;
  create table auth.users(id uuid primary key default gen_random_uuid(), email text, phone text, raw_user_meta_data jsonb default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable as \\\$\\\$ select nullif(current_setting('test.uid', true),'')::uuid \\\$\\\$;
  create role authenticated;\""

Q "-q -v ON_ERROR_STOP=1 -f '$WORK/mig.sql'" >/dev/null
echo "== HerbHub RLS security tests =="
Q "-q -v ON_ERROR_STOP=1 -f '$WORK/test.sql'" 2>&1 | grep -E 'PASS|FAIL|PASSED|FAILED|ERROR'
