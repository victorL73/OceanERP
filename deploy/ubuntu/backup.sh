#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
source .env

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_dir="/opt/oceanerp/backups/$timestamp"
mkdir -p "$backup_dir"

docker compose --env-file .env -f docker-compose.yml exec -T postgres pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" | gzip > "$backup_dir/postgres.sql.gz"
docker run --rm -v oceanerp_documents:/documents -v "$backup_dir":/backup alpine tar -czf /backup/documents.tar.gz -C /documents .

find /opt/oceanerp/backups -mindepth 1 -maxdepth 1 -type d -mtime +"${BACKUP_RETENTION_DAYS:-14}" -exec rm -rf {} \;
echo "Backup created in $backup_dir"

