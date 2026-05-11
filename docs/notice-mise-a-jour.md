# Notice mise à jour

```bash
cd deploy/ubuntu
./update.sh
```

Le script lance une sauvegarde, tire les images, reconstruit les services applicatifs et redémarre Docker Compose.

Avant une mise à jour majeure :

- vérifier les notes de migration
- sauvegarder PostgreSQL et les documents
- tester sur préproduction
- vérifier les migrations EF Core

