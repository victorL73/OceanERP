# Notice sauvegarde et restauration

Les sauvegardes couvrent deux elements distincts :

- PostgreSQL : donnees relationnelles et metadonnees.
- Documents : fichiers binaires stockes hors base de donnees dans le volume `oceanerp_documents`.

## 1. Creer une sauvegarde

Depuis l'interface OceanERP, un administrateur peut utiliser le module `Sauvegardes` :

- `Sauvegardes > Lancer une sauvegarde` execute le script `deploy/ubuntu/backup.sh`.
- La liste affiche les archives disponibles, leur taille et la presence des fichiers PostgreSQL/documents.
- Le bouton `Telecharger` recupere une archive ZIP contenant `postgres.sql.gz` et `documents.tar.gz`.
- Le bloc `Automatisation periodique` permet d'activer une sauvegarde serveur toutes les X heures.
- Depuis l'interface, le conteneur API utilise `pg_dump`, `psql` et le volume documents monte directement. En SSH, les memes scripts utilisent Docker Compose comme avant.

La sauvegarde peut aussi etre lancee en SSH :

```bash
cd ~/OceanERP/deploy/ubuntu
./backup.sh
```

Le script cree un dossier horodate :

```text
/opt/oceanerp/backups/YYYYMMDDTHHMMSSZ
```

Contenu attendu :

```text
postgres.sql.gz
documents.tar.gz
```

Exemple de verification :

```bash
ls -lh /opt/oceanerp/backups/YYYYMMDDTHHMMSSZ
```

Sur une installation vide, les fichiers peuvent etre tres petits. C'est normal.

## 2. Controler l'integrite

Verifier l'archive PostgreSQL :

```bash
gzip -t /opt/oceanerp/backups/YYYYMMDDTHHMMSSZ/postgres.sql.gz
```

Si la commande ne retourne rien, l'archive est valide.

Verifier l'archive documents :

```bash
tar -tzf /opt/oceanerp/backups/YYYYMMDDTHHMMSSZ/documents.tar.gz
```

Sur un Drive vide, la sortie peut simplement etre :

```text
./
```

## 3. Droits des fichiers de sauvegarde

Le script `backup.sh` force le proprietaire de l'archive documents sur l'utilisateur qui lance le script. Si une ancienne sauvegarde contient encore des fichiers `root:root`, corriger avec :

```bash
sudo chown -R $USER:docker /opt/oceanerp/backups
```

## 4. Rotation

La retention est configuree dans `.env` :

```env
BACKUP_RETENTION_DAYS=14
```

Les dossiers plus anciens sont supprimes automatiquement par `backup.sh`.

## 5. Restaurer une sauvegarde

Attention : une restauration remplace le contenu PostgreSQL et le volume documents. Le script vide le schema `public` avant de rejouer l'archive PostgreSQL.

Depuis l'interface OceanERP, utiliser `Sauvegardes > Restaurer` sur la sauvegarde voulue. L'API execute `deploy/ubuntu/restore.sh` avec le dossier de sauvegarde selectionne.

La restauration peut aussi etre lancee en SSH :

```bash
cd ~/OceanERP/deploy/ubuntu
./restore.sh /opt/oceanerp/backups/YYYYMMDDTHHMMSSZ
```

Apres restauration :

```bash
docker compose --env-file .env -f docker-compose.yml ps
curl http://localhost:8080/api/health
```

## 6. Stockage externe SFTP

Le module `Sauvegardes` permet de configurer un serveur de stockage externe pour garder une copie hors du serveur ERP.

Depuis l'interface :

- renseigner `Hote`, `Port`, `Utilisateur`, `Mot de passe` et `Chemin distant`.
- cliquer sur `Tester` pour verifier la connexion SFTP et la creation d'un fichier de test.
- activer `Envoyer apres chaque sauvegarde` pour copier automatiquement chaque nouvelle archive ZIP.
- utiliser `Envoyer externe` sur une archive existante pour forcer un transfert manuel.

Le serveur externe doit exposer SFTP, souvent sur le port `22`, et l'utilisateur doit avoir le droit d'ecrire dans le dossier cible. Exemple de dossier distant :

```text
/backups/oceanerp
```

L'ERP garde toujours les sauvegardes locales dans `/opt/oceanerp/backups`. En cas de perte du serveur principal, recuperer l'archive ZIP depuis le serveur externe, l'extraire, puis replacer le dossier horodate dans `/opt/oceanerp/backups` avant restauration.

Exemple :

```bash
mkdir -p /opt/oceanerp/backups/20260520T120000Z
unzip oceanerp-backup-20260520T120000Z.zip -d /opt/oceanerp/backups/20260520T120000Z
cd ~/OceanERP/deploy/ubuntu
./restore.sh /opt/oceanerp/backups/20260520T120000Z
```

Important : le mot de passe SFTP est masque dans l'interface et n'est jamais renvoye par l'API. Utiliser un compte dedie aux sauvegardes avec des droits limites au dossier distant.

## 7. Recommandations

- Tester regulierement une restauration sur un serveur de preproduction.
- Copier les sauvegardes hors du serveur ERP.
- Chiffrer les sauvegardes si elles sortent du reseau interne.
- Ne jamais supprimer `oceanerp_documents` sans sauvegarde valide.

## 8. Module Sauvegardes dans Docker

Pour permettre a l'interface de piloter les scripts, le conteneur `erp-api` monte :

- `${BACKUP_ROOT:-/opt/oceanerp/backups}` cote serveur, monte en `/opt/oceanerp/backups` dans le conteneur API.
- le dossier `deploy/ubuntu` en lecture seule dans `/opt/oceanerp/deploy/ubuntu`.
- le volume documents dans `/var/lib/oceanerp/documents`.

Variables utiles :

```env
BACKUP_ROOT=/opt/oceanerp/backups
BACKUP_RETENTION_DAYS=14
BACKUP_COMMAND_TIMEOUT_SECONDS=900
BACKUP_SCHEDULE_ENABLED=false
BACKUP_SCHEDULE_INTERVAL_HOURS=24
```

Si le module affiche `Script de sauvegarde introuvable` ou une erreur Docker, verifier que le deploiement a bien ete reconstruit avec :

```bash
docker compose --env-file .env -f docker-compose.yml build --no-cache erp-api nginx
docker compose --env-file .env -f docker-compose.yml up -d --force-recreate erp-api nginx
```
