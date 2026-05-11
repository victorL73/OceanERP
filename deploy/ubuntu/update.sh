#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
./backup.sh
docker compose --env-file .env -f docker-compose.yml pull
docker compose --env-file .env -f docker-compose.yml up -d --build

