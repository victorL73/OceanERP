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
- `PRESTASHOP_COLISSIMO_LABEL_ENDPOINT_TEMPLATE` optionnel, si le module Colissimo expose une URL de recuperation d'etiquette. Variables disponibles : `{shopUrl}`, `{apiBaseUrl}`, `{orderId}`, `{orderReference}`, `{orderNumber}`.
- `SMTP_MAIN_PASSWORD` si un compte mail utilise ce nom de secret
- `BACKUP_RETENTION_DAYS`

Par securite, `EMAIL_ENABLE_SMTP_SENDING=false` par defaut. Dans ce mode, les emails sont journalises dans l'ERP mais ne sont pas envoyes au serveur SMTP.

Pour envoyer reellement les emails et les devis, modifier `~/OceanERP/deploy/ubuntu/.env` :

```env
EMAIL_ENABLE_SMTP_SENDING=true
```

Puis recreer l'API pour relire la variable :

```bash
cd ~/OceanERP/deploy/ubuntu
docker compose --env-file .env -f docker-compose.yml up -d --force-recreate erp-api nginx
```

Le bouton `Test SMTP` teste la connexion et l'authentification SMTP de la boite. Si `EMAIL_ENABLE_SMTP_SENDING=false`, le test peut etre OK mais les envois utilisateur resteront journalises avec le statut `Logged`.

`SECRETS_ENCRYPTION_KEY` sert a proteger les secrets applicatifs stockes en base, notamment la cle API PrestaShop et les mots de passe de boites mail configures dans `Parametres`.

Les hotes SMTP/IMAP ne sont pas definis dans `.env` : un administrateur les renseigne dans `Parametres > Boites mail`. Les boites mail utilisent ces serveurs communs; l'adresse et le mot de passe de chaque boite restent geres par l'administrateur. `SMTP_MAIN_PASSWORD` reste utile uniquement si une boite reference ce secret au lieu de stocker son mot de passe chiffre en base.

Dans `Parametres > Boites mail`, la frequence IMAP automatique est exprimee en minutes. La valeur `0` active la releve serveur rapide toutes les 15 secondes; a utiliser si les boites doivent apparaitre presque immediatement dans l'ERP.

Le logo des devis configure dans `Parametres > Devis` est stocke dans le volume `oceanerp_documents`; il est donc inclus dans les sauvegardes documents.

Pour imprimer les etiquettes Colissimo officielles depuis l'ERP, le module Colissimo PrestaShop doit exposer un endpoint telechargeable. Quand l'URL est connue, renseigner par exemple :

```env
PRESTASHOP_COLISSIMO_LABEL_ENDPOINT_TEMPLATE=https://boutique.example.com/modules/colissimo/label.php?id_order={orderId}
```

Puis recreer `erp-api` et `nginx`. Sans endpoint expose par le module, l'ERP garde le bouton visible sur les commandes Colissimo mais affiche un message clair et il faut generer l'etiquette dans le back-office PrestaShop.

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
