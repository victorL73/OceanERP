#!/usr/bin/env bash
set -euo pipefail

sudo mkdir -p /opt/oceanerp/backups /opt/oceanerp/documents /opt/oceanerp/logs
sudo chown -R "$USER":"$USER" /opt/oceanerp

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example. Edit secrets before production deployment."
fi

