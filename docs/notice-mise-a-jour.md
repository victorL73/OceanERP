# Notice mise a jour

## 1. Avant mise a jour

Faire une sauvegarde :

```bash
cd ~/OceanERP/deploy/ubuntu
./backup.sh
```

Verifier rapidement :

```bash
ls -lh /opt/oceanerp/backups
```

## 2. Recuperer le code

```bash
cd ~/OceanERP
git pull --ff-only origin main
```

Si la mise a jour ne contient que de la documentation Markdown, aucune reconstruction Docker n'est necessaire.

Si `.env` ne contient pas encore de cle de chiffrement applicatif, l'ajouter avant de redeployer :

```env
SECRETS_ENCRYPTION_KEY=une-valeur-aleatoire-longue-et-stable
```

Cette valeur doit rester identique apres les mises a jour pour relire les cles API PrestaShop chiffrees.

Si `git pull` indique qu'un fichier local serait ecrase, lire la difference :

```bash
git diff chemin/du/fichier
```

Si les modifications locales sont des droits d'execution ou des corrections temporaires de deploiement, les mettre de cote avant de tirer la mise a jour :

```bash
git stash push -m "modifs locales avant mise a jour" -- deploy/ubuntu
git pull --ff-only origin main
chmod +x deploy/ubuntu/*.sh
git config core.fileMode false
```

Cas utile pour diagnostiquer un serveur en retard :

```bash
git fetch --all --prune
git branch -vv
git status --short --branch
```

## 3. Redemarrer avec reconstruction

```bash
cd ~/OceanERP/deploy/ubuntu
./update.sh
```

Ou manuellement :

```bash
docker compose --env-file .env -f docker-compose.yml build --no-cache nginx erp-api
docker compose --env-file .env -f docker-compose.yml up -d
```

Ne reconstruire `onlyoffice` ou `turn` que si la mise a jour touche explicitement leur image, leur configuration ou leurs variables d'environnement.

## 4. Verifier apres mise a jour

```bash
docker compose --env-file .env -f docker-compose.yml ps
curl http://localhost:8080/api/health
```

Dans le navigateur :

```text
http://IP_DU_SERVEUR:8080
```

## 5. Points d'attention

- Ne pas supprimer `oceanerp_postgres` sur une installation contenant des donnees sans sauvegarde.
- Ne pas supprimer `oceanerp_documents` sans sauvegarde valide.
- Verifier les migrations EF Core lors des mises a jour majeures.
- Pour la Phase 2, verifier que les menus `Commandes`, `Factures`, `Stock`, `Emails` et `PrestaShop` apparaissent apres reconstruction.
- Pour la Phase 3, verifier que les menus `SAV`, `Agenda`, `Meet`, `Signatures`, `Espace`, `Sauvegardes` et `Tresorerie` apparaissent, puis tester un ticket SAV, un evenement agenda, une salle Meet et une demande de signature sur un document Drive.
- Si le navigateur garde l'ancien menu, forcer le rechargement avec `Ctrl+F5` ou vider le cache/service worker de la PWA.
- Tester les restaurations sur preproduction avant une operation sensible.
