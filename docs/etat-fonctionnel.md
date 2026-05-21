# Etat fonctionnel OceanERP

Derniere mise a jour : 2026-05-21.

Ce document sert de vue d'ensemble vivante de ce qui existe dans le depot. Il complete les notices specialisees et permet de verifier rapidement si une fonctionnalite est codee, comment elle est exposee et quelles limites restent connues.

## Synthese

OceanERP est aujourd'hui structure en Clean Architecture :

- backend ASP.NET Core REST, SignalR, EF Core et PostgreSQL ;
- frontend React TypeScript/Vite, PWA et shell Electron Windows ;
- stockage documentaire sur disque Ubuntu, hors PostgreSQL ;
- PostgreSQL limite aux donnees metier et metadonnees ;
- Docker Compose Ubuntu avec API, PostgreSQL, Nginx, ONLYOFFICE et coturn ;
- generation PDF avec QuestPDF ;
- emails SMTP/IMAP avec MailKit/MimeKit ;
- integration PrestaShop avec synchronisation automatique serveur.

Les fichiers binaires ne doivent jamais etre stockes en base. Les documents sont recuperes uniquement via API securisee ou URL temporaire signee quand un composant externe, comme ONLYOFFICE, doit les lire.

## Phase 1 - MVP stabilise

Fonctionnalites presentes :

- authentification JWT, refresh tokens, deconnexion et profil utilisateur ;
- utilisateurs, roles, permissions granulaires et journal d'audit ;
- clients avec fiche detaillee, contacts, adresses et synchronisation PrestaShop ;
- produits avec reference, designation, description, image, marque, categorie, fournisseur, prix, TVA et statut actif ;
- devis avec numerotation, lignes, remises, TVA, totaux, validite, PDF QuestPDF, envoi email, changement de statut et transformation en commande ;
- PDF devis personnalise depuis `Parametres > Devis` ;
- changement de statut devis avec regeneration du PDF courant, sans creer une nouvelle version artificielle ;
- Drive avec dossiers, multi-upload, liste/mosaique, apercu, renommage, deplacement, glisser/deposer, corbeille, restauration et liens metier ;
- PDF generes depuis les devis retrouves dans le Drive et reutilisables pour signature ;
- notifications internes regroupees et SignalR ;
- dashboard personnalisable avec blocs activables ;
- frontend web/PWA, Electron et Docker Compose.

## Phase 2 - Socle operationnel

Fonctionnalites presentes :

- commandes creees depuis devis ou importees depuis PrestaShop ;
- details commandes : client, statut ERP, statut PrestaShop, paiement, transporteur, livraison, lignes, historique, bon d'expedition et expedition ;
- etiquettes Colissimo officielles recuperees uniquement si le module/pont PrestaShop expose une URL valide ; aucune etiquette factice ne doit etre generee en silence ;
- factures depuis commandes, paiements, avoirs, annulation controlee, PDF et XML preparatoire Factur-X ;
- stock par produit et entrepot, mouvements, correction, transfert, seuil, statut automatique et historique ;
- notifications de stock bas regroupees en une notification active, reactivee si le besoin est toujours present ;
- achats fournisseurs multi-lignes avec fournisseur, entrepot de reception, frais annexes, commentaires, date de reception et reception vers stock ;
- emails SMTP/IMAP : configuration serveur admin, boites affectees aux utilisateurs, signatures HTML, modeles, CC/CCI, pieces jointes, suppression logique, conversations, listes de diffusion et marquage lu automatique ;
- synchronisation PrestaShop automatique invisible : produits, clients, commandes, stocks et messages SAV ;
- tresorerie calculee depuis commandes, factures, paiements, achats, TVA et mouvements utiles.

## Phase 3 - Modules avances

Fonctionnalites presentes :

- SAV avec tickets, messages, priorites, statuts, responsable interne, filtres par utilisateur actif et import des messages PrestaShop ;
- reponses SAV poussees vers PrestaShop quand le ticket vient d'un message client PrestaShop et que la connexion est valide ;
- agenda avec vues jour, semaine et mois, evenements visibles et creation de salles Meet depuis un evenement ;
- signature interne avec lien public, OTP email, expiration, acceptation, signature par clic ou dessinee, hash SHA-256, IP, user-agent, horodatage et document signe ;
- signature affichee sur la premiere page du PDF signe ;
- ONLYOFFICE pour DOCX/XLSX/PPTX via URL temporaire signee et callback de sauvegarde dans Drive ;
- Espace de travail Flowcean integre a l'ERP et branche a la base principale ;
- Meet integre avec salles, invite externe sans compte ERP, code/lien, camera, micro, partage d'ecran, chat, pieces jointes, transcription et traduction ;
- sauvegardes serveur avec lancement manuel, telechargement, restauration, planification, heure locale, retention et stockage externe SFTP ;
- Electron avec URL serveur configurable, notifications natives et support de mise a jour future.

## Limites connues

Ces points existent ou sont amorces, mais ne doivent pas etre presentes comme definitivement certifies :

- Factur-X : export XML preparatoire disponible, mais PDF/A-3 + XML embarque certifie reste a finaliser.
- API externe : Swagger et base securisee presents, mais le portail complet API keys, quotas et permissions avancees reste a durcir.
- Colissimo : l'etiquette officielle depend du module/pont PrestaShop. Si l'endpoint n'est pas expose ou renvoie 404, l'ERP doit afficher une erreur et ne pas generer une fausse etiquette.
- Meet : les flux camera/micro/ecran exigent HTTPS, permissions navigateur/Electron et TURN correctement configure. En cas d'ecran noir, verifier d'abord HTTPS, TURN et les logs SignalR.
- ONLYOFFICE : les fichiers volumineux, surtout XLSX, peuvent etre lents selon la taille du document et la puissance du serveur. L'erreur `errorCode -4` signifie generalement que Document Server ne peut pas telecharger le fichier depuis l'URL signee.
- Production : remplacer tous les secrets, tester les restaurations, activer HTTPS, surveiller les logs, verifier les droits Drive et ajouter monitoring.

## Mise a jour serveur

Pour recuperer uniquement une mise a jour de documentation :

```bash
cd ~/OceanERP
git pull --ff-only origin main
```

Aucune reconstruction Docker n'est necessaire pour lire les fichiers Markdown.

Pour une mise a jour applicative :

```bash
cd ~/OceanERP/deploy/ubuntu
./backup.sh
cd ~/OceanERP
git pull --ff-only origin main
cd deploy/ubuntu
docker compose --env-file .env -f docker-compose.yml build --no-cache erp-api nginx
docker compose --env-file .env -f docker-compose.yml up -d --force-recreate erp-api nginx
```

Recreer aussi `onlyoffice` ou `turn` uniquement si la mise a jour touche leur configuration.

## Commandes de controle

```bash
cd ~/OceanERP/deploy/ubuntu
docker compose --env-file .env -f docker-compose.yml ps
curl http://localhost:8080/api/health
docker logs oceanerp-api --tail=100
docker logs oceanerp-nginx --tail=100
docker logs oceanerp-onlyoffice --tail=100
```

Pour verifier que le serveur public est coherent apres passage en HTTPS :

```bash
curl -I https://interne.renovboat.com/api/health
curl -I https://interne.renovboat.com/onlyoffice/web-apps/apps/api/documents/api.js
```
