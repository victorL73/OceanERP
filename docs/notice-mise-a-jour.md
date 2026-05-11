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
git pull
```

Si `git pull` indique qu'un fichier local serait ecrase, lire la difference :

```bash
git diff chemin/du/fichier
```

Si la modification locale etait uniquement un correctif manuel deja integre au depot distant :

```bash
git checkout -- chemin/du/fichier
git pull
```

Cas vu pendant l'installation :

```bash
git checkout -- frontend/tsconfig.node.json
git pull
```

## 3. Redemarrer avec reconstruction

```bash
cd ~/OceanERP/deploy/ubuntu
./update.sh
```

Ou manuellement :

```bash
docker compose --env-file .env -f docker-compose.yml up -d --build
```

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
- Tester les restaurations sur preproduction avant une operation sensible.

