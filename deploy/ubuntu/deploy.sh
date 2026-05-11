#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
docker compose --env-file .env -f docker-compose.yml up -d --build
docker compose --env-file .env -f docker-compose.yml ps

