# Notice de deploiement Ubuntu

Cette notice reprend le chemin valide teste sur Ubuntu Server avec Docker Compose, Nginx, PostgreSQL, ONLYOFFICE et OceanERP.

## 1. Recuperer le depot

```bash
cd ~
git clone https://github.com/victorL73/OceanERP.git
cd ~/OceanERP/deploy/ubuntu
```

Si le depot existe deja :

```bash
cd ~/OceanERP
git pull
cd deploy/ubuntu
```

Si `git pull` refuse d'ecraser un fichier modifie localement, par exemple `frontend/tsconfig.node.json`, verifier puis restaurer le fichier :

```bash
git diff frontend/tsconfig.node.json
git checkout -- frontend/tsconfig.node.json
git pull
```

## 2. Rendre les scripts executables

Si `./install-prerequisites.sh` renvoie `Permission denied` :

```bash
cd ~/OceanERP/deploy/ubuntu
chmod +x *.sh
```

Si les scripts ont ete copies depuis Windows et affichent une erreur de type `bad interpreter` :

```bash
sed -i 's/\r$//' *.sh
chmod +x *.sh
```

On peut aussi lancer un script sans changer ses droits :

```bash
bash ./install-prerequisites.sh
```

## 3. Installer Docker

```bash
./install-prerequisites.sh
```

Si Docker repond `permission denied while trying to connect to the Docker daemon socket`, ajouter l'utilisateur courant au groupe Docker :

```bash
sudo usermod -aG docker $USER
newgrp docker
docker ps
```

Une deconnexion/reconnexion SSH produit le meme effet que `newgrp docker`.

## 4. Configurer le fichier .env

Le fichier `.env` est stocke ici :

```bash
~/OceanERP/deploy/ubuntu/.env
```

Comme il est cache sous Linux, lister avec :

```bash
ls -la ~/OceanERP/deploy/ubuntu
```

Creation initiale :

```bash
cp .env.example .env
nano .env
```

Variables minimales a changer avant production :

- `POSTGRES_PASSWORD`
- `JWT_SIGNING_KEY`
- `SECRETS_ENCRYPTION_KEY`
- `ERP_ADMIN_EMAIL`
- `ERP_ADMIN_PASSWORD`
- `ONLYOFFICE_JWT_SECRET`
- `ONLYOFFICE_DOCUMENT_SERVER_URL=/onlyoffice`
- `ONLYOFFICE_INTERNAL_BASE_URL=http://nginx`
- `ONLYOFFICE_ALLOW_PRIVATE_IP_ADDRESS=true`
- `ONLYOFFICE_ALLOW_META_IP_ADDRESS=true`
- `PUBLIC_URL`
- `EMAIL_ENABLE_SMTP_SENDING` reste `false` tant que les secrets SMTP ne sont pas configures.
- `PRESTASHOP_AUTO_SYNC_ENABLED=true` et `PRESTASHOP_AUTO_SYNC_INTERVAL_SECONDS=10` activent la synchronisation PrestaShop automatique en quasi temps reel.

Par defaut, le frontend est expose sur le port `8080` via `HTTP_PORT=8080`.

`SECRETS_ENCRYPTION_KEY` doit rester stable entre les redeploiements : elle sert a relire les cles API PrestaShop et les mots de passe mail chiffres en base.

Pour ONLYOFFICE, garder `ONLYOFFICE_DOCUMENT_SERVER_URL=/onlyoffice` pour l'editeur cote navigateur et `ONLYOFFICE_INTERNAL_BASE_URL=http://nginx` pour le telechargement/callback depuis le conteneur ONLYOFFICE. Comme cette URL est interne au reseau Docker, garder aussi `ONLYOFFICE_ALLOW_PRIVATE_IP_ADDRESS=true` et `ONLYOFFICE_ALLOW_META_IP_ADDRESS=true`.

Si un fichier Office affiche `errorCode -4`, le conteneur Document Server n'arrive pas a telecharger le fichier depuis cette URL interne. Apres mise a jour de `.env` ou du compose, recreer ONLYOFFICE :

```bash
cd ~/OceanERP/deploy/ubuntu
docker compose --env-file .env -f docker-compose.yml up -d --force-recreate onlyoffice erp-api nginx
```

Pour activer l'envoi SMTP plus tard, un administrateur renseigne les serveurs dans `Parametres > Boites mail`, cree les boites et saisit les mots de passe. Il est aussi possible de creer une boite avec `PasswordSecretName=SMTP_MAIN_PASSWORD`, puis d'ajouter dans `.env` :

```env
EMAIL_ENABLE_SMTP_SENDING=true
SMTP_MAIN_PASSWORD=mot-de-passe-smtp
```

Apres changement de cette variable, recreer l'API pour que Docker relise `.env` :

```bash
cd ~/OceanERP/deploy/ubuntu
docker compose --env-file .env -f docker-compose.yml up -d --force-recreate erp-api nginx
```

## 5. Demarrer les services

```bash
./setup-server.sh
./deploy.sh
```

Verifier l'etat :

```bash
docker compose --env-file .env -f docker-compose.yml ps
```

Etat attendu :

- `oceanerp-postgres` : `healthy`
- `oceanerp-api` : `Up`
- `oceanerp-nginx` : `Up`
- `oceanerp-onlyoffice` : `Up`

Tester l'API depuis le serveur :

```bash
curl http://localhost:8080/api/health
```

Reponse attendue :

```json
{"status":"ok","service":"OceanERP API"}
```

Depuis un navigateur :

```text
http://IP_DU_SERVEUR:8080
```

Si le firewall Ubuntu est actif :

```bash
sudo ufw allow 8080/tcp
sudo ufw status
```

## 6. Compte administrateur initial

Le compte initial est celui configure dans `.env` :

```env
ERP_ADMIN_EMAIL=admin@oceanerp.local
ERP_ADMIN_PASSWORD=ChangeMe!12345
```

Changer ces valeurs avant une installation definitive.

Si la base est encore vide et que vous voulez regenerer le compte initial apres modification du `.env` :

```bash
docker compose --env-file .env -f docker-compose.yml down
docker volume rm oceanerp_postgres
./deploy.sh
```

Attention : `docker volume rm oceanerp_postgres` supprime la base PostgreSQL. Ne pas utiliser sur une base contenant des donnees utiles sans sauvegarde.

## 7. Probleme PostgreSQL unhealthy

Le compose utilise `postgres:16-alpine`. Cette version evite le changement de montage introduit dans les images PostgreSQL 18.

Si le conteneur PostgreSQL est `unhealthy`, consulter les logs :

```bash
docker logs oceanerp-postgres --tail=120
```

Sur une installation neuve uniquement :

```bash
docker compose --env-file .env -f docker-compose.yml down
docker volume rm oceanerp_postgres
./deploy.sh
```

## 8. Premiere sauvegarde de controle

```bash
./backup.sh
ls -lh /opt/oceanerp/backups
```

Verifier ensuite l'integrite comme decrit dans `docs/notice-sauvegarde-restauration.md`.
