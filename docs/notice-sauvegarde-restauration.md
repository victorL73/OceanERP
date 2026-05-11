# Notice sauvegarde et restauration

## Sauvegarde

```bash
cd deploy/ubuntu
./backup.sh
```

Le script crée :

- `postgres.sql.gz`
- `documents.tar.gz`

dans `/opt/oceanerp/backups/<timestamp>`.

## Restauration

```bash
cd deploy/ubuntu
./restore.sh /opt/oceanerp/backups/YYYYMMDDTHHMMSSZ
```

Le script restaure PostgreSQL et le volume documentaire. Tester la restauration régulièrement sur un environnement séparé.

