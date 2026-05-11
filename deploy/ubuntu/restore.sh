#!/usr/bin/env bash
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: ./restore.sh /opt/oceanerp/backups/YYYYMMDDTHHMMSSZ"
  exit 1
fi

cd "$(dirname "$0")"
source .env
backup_dir="$1"

test -f "$backup_dir/postgres.sql.gz"
test -f "$backup_dir/documents.tar.gz"

docker compose --env-file .env -f docker-compose.yml up -d postgres
gunzip -c "$backup_dir/postgres.sql.gz" | docker compose --env-file .env -f docker-compose.yml exec -T postgres psql -U "${POSTGRES_USER}" "${POSTGRES_DB}"
docker run --rm -v oceanerp_documents:/documents -v "$backup_dir":/backup alpine sh -c "rm -rf /documents/* && tar -xzf /backup/documents.tar.gz -C /documents"
docker compose --env-file .env -f docker-compose.yml up -d

