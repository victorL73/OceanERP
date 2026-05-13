# Deploiement

## Services Docker

- `erp-api` : API ASP.NET Core, migrations EF Core et seed initial.
- `postgres` : PostgreSQL 16.
- `nginx` : frontend statique React et reverse proxy API/SignalR/ONLYOFFICE.
- `onlyoffice` : ONLYOFFICE Docs auto-heberge.

## Ports

Par defaut :

- Nginx est expose sur `HTTP_PORT=8080`.
- L'API est interne au reseau Docker sur `erp-api:8080`.
- PostgreSQL est interne au reseau Docker sur `postgres:5432`.

Test local serveur :

```bash
curl http://localhost:8080/api/health
```

Acces navigateur :

```text
http://IP_DU_SERVEUR:8080
```

## Volumes

- `oceanerp_postgres` : donnees PostgreSQL.
- `oceanerp_documents` : fichiers ERP hors base de donnees.
- `oceanerp_api_logs` : logs API.
- `oceanerp_onlyoffice_data` : donnees ONLYOFFICE.
- `oceanerp_onlyoffice_logs` : logs ONLYOFFICE.

## Fichier .env

Emplacement :

```bash
~/OceanERP/deploy/ubuntu/.env
```

Creation :

```bash
cd ~/OceanERP/deploy/ubuntu
cp .env.example .env
nano .env
```

Variables importantes :

- `PUBLIC_URL`
- `HTTP_PORT`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `JWT_SIGNING_KEY`
- `SECRETS_ENCRYPTION_KEY`
- `ERP_ADMIN_EMAIL`
- `ERP_ADMIN_PASSWORD`
- `ONLYOFFICE_JWT_SECRET`
- `EMAIL_ENABLE_SMTP_SENDING`
- `SMTP_MAIN_PASSWORD` si un compte mail utilise ce nom de secret
- `BACKUP_RETENTION_DAYS`

Par securite, `EMAIL_ENABLE_SMTP_SENDING=false` par defaut. Dans ce mode, les emails sont journalises dans l'ERP mais ne sont pas envoyes au serveur SMTP.

`SECRETS_ENCRYPTION_KEY` sert a proteger les secrets applicatifs stockes en base, notamment la cle API PrestaShop et les mots de passe de boites mail configures dans `Parametres`.

Les hotes SMTP/IMAP ne sont pas definis dans `.env` : un administrateur les renseigne dans `Parametres > Boites mail`. Les boites mail utilisent ces serveurs communs; l'adresse et le mot de passe de chaque boite restent geres par l'administrateur. `SMTP_MAIN_PASSWORD` reste utile uniquement si une boite reference ce secret au lieu de stocker son mot de passe chiffre en base.

## Commandes utiles

```bash
cd ~/OceanERP/deploy/ubuntu
./deploy.sh
docker compose --env-file .env -f docker-compose.yml ps
docker logs oceanerp-api --tail=100
docker logs oceanerp-postgres --tail=100
./backup.sh
```

## HTTPS

Le compose expose Nginx en HTTP. Pour la production :

1. Placer un Nginx hote, Caddy, Traefik ou autre reverse proxy TLS devant `HTTP_PORT`.
2. Installer un certificat Let's Encrypt.
3. Renseigner `PUBLIC_URL=https://votre-domaine`.
4. Restreindre le firewall aux ports utiles.

Le fichier `deploy/ubuntu/nginx.conf` fournit une base pour un Nginx hote qui reverse-proxy vers `127.0.0.1:8080`.

## Depannage rapide

### Script introuvable ou permission refusee

```bash
cd ~/OceanERP/deploy/ubuntu
chmod +x *.sh
bash ./install-prerequisites.sh
```

### Docker permission denied

```bash
sudo usermod -aG docker $USER
newgrp docker
docker ps
```

### PostgreSQL unhealthy

```bash
docker logs oceanerp-postgres --tail=120
```

Sur installation neuve seulement :

```bash
docker compose --env-file .env -f docker-compose.yml down
docker volume rm oceanerp_postgres
./deploy.sh
```
