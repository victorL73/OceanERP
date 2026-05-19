#!/usr/bin/env bash
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: ./restore.sh /opt/oceanerp/backups/YYYYMMDDTHHMMSSZ"
  exit 1
fi

cd "$(dirname "$0")"
if [ -f .env ]; then
  source .env
fi
backup_dir="$1"

test -f "$backup_dir/postgres.sql.gz"
test -f "$backup_dir/documents.tar.gz"

if [ "${BACKUP_USE_DIRECT_DB:-false}" = "true" ]; then
  : "${POSTGRES_HOST:=postgres}"
  : "${POSTGRES_PORT:=5432}"
  : "${DOCUMENTS_ROOT_CONTAINER:=/var/lib/oceanerp/documents}"

  PGPASSWORD="${POSTGRES_PASSWORD}" psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" "${POSTGRES_DB}" -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public AUTHORIZATION \"${POSTGRES_USER}\"; GRANT ALL ON SCHEMA public TO \"${POSTGRES_USER}\"; GRANT ALL ON SCHEMA public TO public;"
  gunzip -c "$backup_dir/postgres.sql.gz" | PGPASSWORD="${POSTGRES_PASSWORD}" psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" "${POSTGRES_DB}"
  find "${DOCUMENTS_ROOT_CONTAINER}" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  tar -xzf "$backup_dir/documents.tar.gz" -C "${DOCUMENTS_ROOT_CONTAINER}"
else
  if docker compose version >/dev/null 2>&1; then
    compose_cmd=(docker compose)
  else
    compose_cmd=(docker-compose)
  fi

  "${compose_cmd[@]}" --env-file .env -f docker-compose.yml up -d postgres
  "${compose_cmd[@]}" --env-file .env -f docker-compose.yml exec -T postgres psql -U "${POSTGRES_USER}" "${POSTGRES_DB}" -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public AUTHORIZATION \"${POSTGRES_USER}\"; GRANT ALL ON SCHEMA public TO \"${POSTGRES_USER}\"; GRANT ALL ON SCHEMA public TO public;"
  gunzip -c "$backup_dir/postgres.sql.gz" | "${compose_cmd[@]}" --env-file .env -f docker-compose.yml exec -T postgres psql -U "${POSTGRES_USER}" "${POSTGRES_DB}"
  docker run --rm -v oceanerp_documents:/documents -v "$backup_dir":/backup alpine sh -c "rm -rf /documents/* && tar -xzf /backup/documents.tar.gz -C /documents"
  "${compose_cmd[@]}" --env-file .env -f docker-compose.yml up -d
fi
