# Déploiement

## Services Docker

- `erp-api` : ASP.NET Core.
- `postgres` : PostgreSQL.
- `nginx` : reverse proxy et frontend statique.
- `onlyoffice` : ONLYOFFICE Docs.

## Volumes

- `oceanerp_postgres` : données PostgreSQL.
- `oceanerp_documents` : fichiers ERP.
- `oceanerp_api_logs` : logs API.
- `oceanerp_onlyoffice_data` : données ONLYOFFICE.
- `oceanerp_onlyoffice_logs` : logs ONLYOFFICE.

## Commandes

```bash
cd deploy/ubuntu
cp .env.example .env
./deploy.sh
./backup.sh
./restore.sh /opt/oceanerp/backups/YYYYMMDDTHHMMSSZ
```

## HTTPS

Le compose expose Nginx sur `HTTP_PORT`. Pour la production, placer un Nginx hôte ou un proxy TLS devant ce port et utiliser un certificat Let's Encrypt.

