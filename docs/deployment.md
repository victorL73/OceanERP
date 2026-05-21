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
- `ONLYOFFICE_DOCUMENT_SERVER_URL`
- `ONLYOFFICE_INTERNAL_BASE_URL`
- `ONLYOFFICE_ALLOW_PRIVATE_IP_ADDRESS`
- `ONLYOFFICE_ALLOW_META_IP_ADDRESS`
- `EMAIL_ENABLE_SMTP_SENDING`
- `PRESTASHOP_AUTO_SYNC_ENABLED` active la synchronisation PrestaShop automatique serveur.
- `PRESTASHOP_AUTO_SYNC_INTERVAL_SECONDS` definit la cadence invisible de synchronisation des produits, clients, commandes, stocks et messages SAV. Valeur par defaut : `10`.
- `MEET_STUN_URLS` liste les serveurs STUN utilises par Meet.
- `MEET_TURN_URLS`, `MEET_TURN_USERNAME` et `MEET_TURN_CREDENTIAL` configurent un serveur TURN si les flux camera/ecran ne passent pas entre deux reseaux.
- `SMTP_MAIN_PASSWORD` si un compte mail utilise ce nom de secret
- `BACKUP_RETENTION_DAYS`
- `BACKUP_SCHEDULE_ENABLED` active la sauvegarde automatique serveur au demarrage si aucun planning n'a encore ete enregistre depuis l'interface.
- `BACKUP_SCHEDULE_INTERVAL_HOURS` definit l'intervalle par defaut entre deux sauvegardes automatiques.

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

### Meet / WebRTC

Le module Meet utilise WebRTC. Par defaut, OceanERP annonce les serveurs STUN publics `stun:stun.l.google.com:19302` et `stun:stun1.l.google.com:19302` via `MEET_STUN_URLS`.

Si deux participants sont sur des reseaux differents et voient un ecran noir alors que la camera est active, il faut configurer un serveur TURN accessible depuis Internet :

```env
MEET_TURN_URLS=turn:votre-domaine:3478?transport=udp,turn:votre-domaine:3478?transport=tcp
MEET_TURN_USERNAME=utilisateur-turn
MEET_TURN_CREDENTIAL=mot-de-passe-turn
```

Apres modification, recreer l'API et le frontend pour que la salle Meet relise la configuration :

```bash
cd ~/OceanERP/deploy/ubuntu
docker compose --env-file .env -f docker-compose.yml up -d --force-recreate erp-api nginx
```

Pour l'edition Office, le bouton `Office` du Drive ouvre ONLYOFFICE directement dans OceanERP pour les fichiers DOCX, XLSX et PPTX compatibles. `PUBLIC_URL` reste l'URL HTTPS publique de l'ERP. `ONLYOFFICE_DOCUMENT_SERVER_URL` vaut generalement `/onlyoffice` derriere Nginx : c'est l'URL chargee par le navigateur pour afficher l'editeur.

`ONLYOFFICE_IMAGE` permet de figer la version du Document Server. La valeur recommandee est `onlyoffice/documentserver:9.3.1` afin d'eviter les changements non maitrises de `latest` lors d'un redeploiement. Apres changement de cette valeur, recréer le conteneur `onlyoffice`.

`ONLYOFFICE_INTERNAL_BASE_URL` sert uniquement a Document Server pour telecharger le fichier et appeler le callback de sauvegarde. Dans Docker Compose, la valeur recommandee est `http://nginx`, car le conteneur ONLYOFFICE rejoint alors le reverse proxy interne Docker et utilise les memes routes `/api/onlyoffice/...` que le reste de l'application. Ne pas remplacer cette valeur par l'URL publique HTTPS sauf si le conteneur ONLYOFFICE peut vraiment joindre cette URL depuis l'interieur du serveur.

Comme `ONLYOFFICE_INTERNAL_BASE_URL` pointe vers une adresse Docker privee, le conteneur `onlyoffice/documentserver` doit autoriser ce type d'adresse avec `ONLYOFFICE_ALLOW_PRIVATE_IP_ADDRESS=true` et `ONLYOFFICE_ALLOW_META_IP_ADDRESS=true`. Ces variables sont deja presentes dans `.env.example` et transmises a Document Server par Docker Compose.

La configuration envoyee au Document Server contient un JWT signe par `ONLYOFFICE_JWT_SECRET`, puis les sauvegardes sont versionnees dans Drive. Si ONLYOFFICE affiche `errorCode -4` / `Echec du telechargement`, verifier en priorite `ONLYOFFICE_INTERNAL_BASE_URL`, `ONLYOFFICE_ALLOW_PRIVATE_IP_ADDRESS`, `ONLYOFFICE_ALLOW_META_IP_ADDRESS`, les logs `oceanerp-onlyoffice` et l'acces interne a `http://nginx/api/health` depuis le conteneur ONLYOFFICE.

Pour les fichiers Excel, OceanERP force la coedition stricte et desactive autosave/forcesave/plugins dans la session ONLYOFFICE. Les callbacks `status=6` emis tres souvent par les tableurs sont acquittes sans reecrire le fichier a chaque sortie de cellule; la version Drive est conservee sur le callback final `status=2` a la fermeture normale du document. Fermer puis rouvrir une ancienne fenetre ONLYOFFICE apres redeploiement permet aussi de purger les preferences navigateur qui pourraient reactiver une sauvegarde trop frequente.

Apres ajout ou modification de ces variables, recreer au minimum ONLYOFFICE et l'API :

```bash
cd ~/OceanERP/deploy/ubuntu
docker compose --env-file .env -f docker-compose.yml up -d --force-recreate onlyoffice erp-api nginx
```

Pour imprimer les etiquettes Colissimo officielles depuis l'ERP, le module Colissimo PrestaShop doit exposer un endpoint telechargeable. Quand l'URL est connue, renseigner par exemple :

1. Aller dans `Parametres > PrestaShop`.
2. Modifier la connexion de la boutique.
3. Renseigner `URL etiquette Colissimo` avec une URL de recuperation d'etiquette, par exemple `https://boutique.example.com/modules/colissimo/label.php?id_order={orderId}`.

Variables disponibles dans cette URL : `{shopUrl}`, `{apiBaseUrl}`, `{orderId}`, `{externalOrderId}`, `{orderReference}`, `{orderNumber}`, `{trackingNumber}`. Plusieurs URL peuvent etre separees par `;`.

L'ERP tente aussi les ressources API Colissimo connues, dont `colissimo_ace`, `colissimo_labels` et les variantes de labels. Si le module renvoie un PDF, une image ou un ZIP, le fichier officiel est ouvert directement.

Si aucune ressource API ne contient l'etiquette, installer le pont PrestaShop fourni :

1. Copier le dossier `deploy/prestashop/oceanerpbridge` dans le dossier `modules/` de PrestaShop, ou creer le zip avec `powershell -ExecutionPolicy Bypass -File deploy/prestashop/build-oceanerpbridge.ps1` puis l'installer depuis le back-office.
2. Installer le module `OceanERP Bridge` dans PrestaShop.
3. Copier son token de securite.
4. Renseigner le meme token dans `Parametres > PrestaShop`, champ `Token pont Colissimo optionnel`.

Avec ce token, OceanERP tente automatiquement :

```text
{shopUrl}/modules/oceanerpbridge/label.php?token=...&id_order={orderId}
{shopUrl}/module/oceanerpbridge/colissimolabel?token=...&id_order={orderId}
{shopUrl}/index.php?fc=module&module=oceanerpbridge&controller=colissimolabel&token=...&id_order={orderId}
```

Le pont lit uniquement les fichiers locaux de PrestaShop, cherche dans toutes les tables et tous les dossiers dont le nom contient `colissimo` ou `laposte`, extrait les chemins, JSON, XML, valeurs base64 PDF/ZIP/ZPL et fichiers locaux rattaches a la commande, puis les renvoie a OceanERP. L'URL directe `/modules/oceanerpbridge/label.php` evite les problemes de routage du front-controller PrestaShop. Aucun fichier binaire n'est stocke dans PostgreSQL.

Apres une mise a jour du pont, reconstruire le zip puis reinstaller/mettre a jour le module PrestaShop :

```powershell
cd C:\Users\Xxvic\Documents\GitHub\OceanERP
powershell -ExecutionPolicy Bypass -File .\deploy\prestashop\build-oceanerpbridge.ps1
```

Le fichier a charger dans PrestaShop est `deploy/prestashop/oceanerpbridge.zip`.

Si le module ne propose qu'un bouton dans le back-office, ouvrir les outils developpeur du navigateur, generer l'etiquette dans PrestaShop, copier l'URL exacte qui telecharge le PDF/ZIP, puis remplacer l'identifiant de commande par `{externalOrderId}` dans le champ `URL etiquette Colissimo`. L'URL de la page `AdminColissimoAffranchissement` seule ne suffit generalement pas : elle affiche l'ecran du module mais ne telecharge pas l'etiquette.

Puis recreer `erp-api` et `nginx`. Sans endpoint expose par le module, l'ERP garde le bouton visible sur les commandes Colissimo mais renvoie une erreur explicite au lieu de generer un PDF de remplacement. L'etiquette officielle reste a creer ou telecharger dans le back-office PrestaShop tant que le module Colissimo ne l'expose pas par URL/API.

## Commandes utiles

```bash
cd ~/OceanERP/deploy/ubuntu
./deploy.sh
docker compose --env-file .env -f docker-compose.yml ps
docker logs oceanerp-api --tail=100
docker logs oceanerp-postgres --tail=100
./backup.sh
```

Le module `Sauvegardes` peut aussi envoyer les archives vers un serveur externe SFTP. Configurez ce serveur depuis l'interface administrateur, puis utilisez `Tester` avant d'activer l'envoi automatique apres sauvegarde.

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
