# Notice sauvegarde et restauration

Les sauvegardes couvrent deux elements distincts :

- PostgreSQL : donnees relationnelles et metadonnees.
- Documents : fichiers binaires stockes hors base de donnees dans le volume `oceanerp_documents`.

## 1. Creer une sauvegarde

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

Attention : une restauration remplace le contenu PostgreSQL et le volume documents.

```bash
cd ~/OceanERP/deploy/ubuntu
./restore.sh /opt/oceanerp/backups/YYYYMMDDTHHMMSSZ
```

Apres restauration :

```bash
docker compose --env-file .env -f docker-compose.yml ps
curl http://localhost:8080/api/health
```

## 6. Recommandations

- Tester regulierement une restauration sur un serveur de preproduction.
- Copier les sauvegardes hors du serveur ERP.
- Chiffrer les sauvegardes si elles sortent du reseau interne.
- Ne jamais supprimer `oceanerp_documents` sans sauvegarde valide.

