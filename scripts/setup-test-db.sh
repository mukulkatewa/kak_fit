#!/usr/bin/env bash
# Creates (if needed) and migrates the throwaway database used by integration tests.
# Safe to re-run. Never touches the dev database.
#
# Works with either the docker-compose Postgres or a local (e.g. Homebrew) one.
# Override anything with TEST_DATABASE_URL, PGUSER, PGHOST, PGPORT, TEST_DB_NAME.
set -euo pipefail

TEST_DB_NAME="${TEST_DB_NAME:-kak_fit_test}"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
CONTAINER="${PG_CONTAINER:-kak_fit_postgres}"

# --- Pick a connection strategy -------------------------------------------------
# 1. docker-compose container (matches docker-compose.yml: postgres/postgres)
# 2. local psql as $PGUSER, then "postgres", then the current OS user
run_sql=""
resolved_user=""
resolved_password=""

if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "${CONTAINER}"; then
  resolved_user="${PGUSER:-postgres}"
  resolved_password="${PGPASSWORD:-postgres}"
  run_sql() {
    docker exec -e PGPASSWORD="${resolved_password}" -i "${CONTAINER}" \
      psql -U "${resolved_user}" -d postgres -tAc "$1"
  }
  echo "→ Using docker container '${CONTAINER}'"
elif command -v psql >/dev/null 2>&1; then
  for candidate in "${PGUSER:-}" postgres "${USER}"; do
    [ -z "${candidate}" ] && continue
    if PGPASSWORD="${PGPASSWORD:-}" psql -h "${PGHOST}" -p "${PGPORT}" -U "${candidate}" \
         -d postgres -tAc "SELECT 1" >/dev/null 2>&1; then
      resolved_user="${candidate}"
      resolved_password="${PGPASSWORD:-}"
      break
    fi
  done

  if [ -z "${resolved_user}" ]; then
    echo "✗ Could not connect to Postgres at ${PGHOST}:${PGPORT}." >&2
    echo "  Tried users: ${PGUSER:-<unset>}, postgres, ${USER}" >&2
    echo "  Start it with 'pnpm docker:up', or set PGUSER/PGPASSWORD." >&2
    exit 1
  fi

  run_sql() {
    PGPASSWORD="${resolved_password}" psql -h "${PGHOST}" -p "${PGPORT}" -U "${resolved_user}" \
      -d postgres -tAc "$1"
  }
  echo "→ Using local Postgres at ${PGHOST}:${PGPORT} as '${resolved_user}'"
else
  echo "✗ No Postgres found. Start one with 'pnpm docker:up' or install psql." >&2
  exit 1
fi

# --- Build the URL the tests will use -------------------------------------------
if [ -n "${TEST_DATABASE_URL:-}" ]; then
  RESOLVED_URL="${TEST_DATABASE_URL}"
else
  if [ -n "${resolved_password}" ]; then
    RESOLVED_URL="postgresql://${resolved_user}:${resolved_password}@${PGHOST}:${PGPORT}/${TEST_DB_NAME}"
  else
    RESOLVED_URL="postgresql://${resolved_user}@${PGHOST}:${PGPORT}/${TEST_DB_NAME}"
  fi
fi

# --- Create + migrate ------------------------------------------------------------
if [ "$(run_sql "SELECT 1 FROM pg_database WHERE datname='${TEST_DB_NAME}'")" = "1" ]; then
  echo "→ Database '${TEST_DB_NAME}' already exists"
else
  echo "→ Creating database '${TEST_DB_NAME}'"
  run_sql "CREATE DATABASE ${TEST_DB_NAME}" >/dev/null
fi

echo "→ Pushing Prisma schema"
cd "$(dirname "$0")/.."
# The schema declares both url and directUrl; for a local test DB they're the same.
DATABASE_URL="${RESOLVED_URL}" DIRECT_URL="${RESOLVED_URL}" \
  pnpm --filter @kak-fit/db exec prisma db push --accept-data-loss --skip-generate

echo ""
echo "✓ Test database ready."
echo ""
echo "  Add this to your .env so 'pnpm test:integration' picks it up:"
echo "    TEST_DATABASE_URL=\"${RESOLVED_URL}\""
