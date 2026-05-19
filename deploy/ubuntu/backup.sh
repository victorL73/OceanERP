#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
if [ -f .env ]; then
  source .env
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_root="${BACKUP_ROOT_CONTAINER:-${BACKUP_ROOT:-/opt/oceanerp/backups}}"
backup_dir="$backup_root/$timestamp"
mkdir -p "$backup_dir"

if [ "${BACKUP_USE_DIRECT_DB:-false}" = "true" ]; then
  : "${POSTGRES_HOST:=postgres}"
  : "${POSTGRES_PORT:=5432}"
  : "${DOCUMENTS_ROOT_CONTAINER:=/var/lib/oceanerp/documents}"

  PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" "${POSTGRES_DB}" | gzip > "$backup_dir/postgres.sql.gz"
  tar -czf "$backup_dir/documents.tar.gz" -C "${DOCUMENTS_ROOT_CONTAINER}" .
else
  if docker compose version >/dev/null 2>&1; then
    compose_cmd=(docker compose)
  else
    compose_cmd=(docker-compose)
  fi

  "${compose_cmd[@]}" --env-file .env -f docker-compose.yml exec -T postgres pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" | gzip > "$backup_dir/postgres.sql.gz"
  docker run --rm -v oceanerp_documents:/documents:ro -v "$backup_dir":/backup alpine sh -c "tar -czf /backup/documents.tar.gz -C /documents . && chown -R $(id -u):$(id -g) /backup"
fi

find "$backup_root" -mindepth 1 -maxdepth 1 -type d -mtime +"${BACKUP_RETENTION_DAYS:-14}" -exec rm -rf {} \;
echo "Backup created in $backup_dir"
