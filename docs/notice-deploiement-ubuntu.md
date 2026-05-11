# Notice de déploiement Ubuntu

1. Copier le dépôt sur le serveur Ubuntu.
2. Aller dans `deploy/ubuntu`.
3. Lancer `./install-prerequisites.sh`.
4. Lancer `./setup-server.sh`.
5. Modifier `.env` et remplacer tous les secrets.
6. Lancer `./deploy.sh`.
7. Vérifier `docker compose --env-file .env -f docker-compose.yml ps`.
8. Ouvrir `PUBLIC_URL`.

Compte initial :

- `ERP_ADMIN_EMAIL`
- `ERP_ADMIN_PASSWORD`

Changez le mot de passe admin immédiatement après le premier accès.

