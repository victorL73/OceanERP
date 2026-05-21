# Architecture

OceanERP suit une Clean Architecture stricte.

## Couches

- `Erp.Domain` contient les entités, enums et règles métier pures. Aucune dépendance EF Core ou ASP.NET.
- `Erp.Application` contient les DTOs et interfaces de services. Les contrôleurs dépendent de cette couche.
- `Erp.Infrastructure` implémente les interfaces applicatives avec EF Core, PostgreSQL, JWT, QuestPDF et stockage disque.
- `Erp.Api` expose REST, SignalR, Swagger, CORS, rate limiting, middleware d'erreurs et authentification.

## Modules MVP

- Authentification JWT, refresh tokens et espace Parametres pour le profil utilisateur.
- RBAC avec roles, permissions granulaires et ecran admin `Utilisateurs/Roles`.
- Clients.
- Produits, catégories et fournisseurs produits.
- Devis avec calculs, statuts et PDF QuestPDF.
- Drive simple avec dossiers, fichiers, versions, métadonnées, recherche, corbeille/restauration et liens documentaires clients/produits.
- Notifications internes, hub SignalR et notification navigateur lorsque l'application est ouverte.
- Dashboard de base.

## Modules prepares

Les anciens placeholders de vocabulaire restent utiles pour tracer l'intention produit, mais les modules principaux des phases 2 et 3 disposent maintenant de services, DTOs, controllers, migrations et ecrans dedies. Les points encore a finaliser sont documentes dans `docs/etat-fonctionnel.md`.

## Phase 2 cloturee

La Phase 2 dispose maintenant d'un socle backend/API et frontend pour :

- commandes clients depuis devis ou depuis PrestaShop, detail complet de livraison, statuts boutique, expedition, bon d'expedition ERP et tentative de recuperation d'etiquette Colissimo officielle ;
- workflow commande `Draft -> Confirmed -> Preparing/Shipped -> Completed/Cancelled`, avec reservation de stock a la confirmation et decrementation a l'expedition ;
- factures depuis commande expediee, prevention des doubles facturations, paiements, avoirs rattaches a la facture d'origine, statut `Overdue` calcule automatiquement, annulation controlee et historique de statut ;
- PDF facture QuestPDF stocke hors base de donnees, avec metadonnees uniquement en PostgreSQL ;
- stock par entrepot avec mouvements d'ajustement, transfert, reservation, liberation, expedition et reception fournisseur, filtres/tri et statut automatique (`En stock`, `Stock bas`, `Hors stock`, `Reapprovisionnement`) ;
- achats fournisseurs multi-lignes avec fournisseur, entrepot de reception, frais annexes, commentaires, date de reception prevue, retour de statut et reception vers stock ;
- notifications journaliere regroupee de stock bas, reactivee tant que le besoin reste ouvert et ignoree pour les produits inactifs ou deja couverts par une commande fournisseur ouverte ;
- module email complet pour la Phase 2 : serveurs SMTP/IMAP globaux, boites affectees aux utilisateurs, signatures HTML, CC/CCI, pieces jointes, suppression logique, synchronisation IMAP manuelle/automatique et journal des messages ;
- connecteur PrestaShop avec configuration protegee de cle API, import produits/clients/stocks/commandes/messages SAV, publication des modifications produits/clients/stocks et journal de synchronisation.

## Phase 3 cloturee

La Phase 3 ajoute maintenant un socle exploitable et extensible pour :

- SAV : tickets lies aux clients, produits et commandes, priorites, statuts, messages, historique, rattachement possible de piece Drive et import quasi temps reel des conversations PrestaShop ;
- agenda : evenements, rappels, liens vers les modules metier, evenements prives/publics, vue calendrier simple et notifications automatiques de rappel ;
- signature interne : demandes de signature sur documents Drive, liens publics securises, OTP email, expiration, acceptation des conditions, signature par clic ou dessinee, SHA-256 du document, IP, user-agent, horodatage, preuve et document signe stocke hors base ;
- ONLYOFFICE : configuration d'edition pour DOCX/XLSX/PPTX, URL document temporaire signee et callback de sauvegarde vers une nouvelle version Drive ;
- Espace : integration Flowcean branchee a la base principale, pages, blocs, favoris, corbeille, import/export et compatibilite UI ;
- Meet : salles de reunion, invite public sans compte ERP, signaux WebRTC, TURN, chat, pieces jointes, transcription et traduction ;
- Sauvegardes : lancement manuel, telechargement, restauration, planification, heure locale, retention et stockage externe SFTP ;
- Tresorerie : solde utile, TVA et mouvements calcules depuis les donnees commerciales et achats ;
- Factur-X : export XML preparatoire depuis les factures et les avoirs pour preparer l'etape PDF/A-3 + XML embarque ;
- Electron avance : choix serveur sans rebuild, notifications natives Windows et support `electron-updater`.

Les points volontairement conserves en evolution controlee sont : export Factur-X pleinement conforme EN16931 avec PDF/A-3 et XML embarque, module API keys externe avance, stabilisation WebRTC multi-postes selon HTTPS/TURN et optimisation des gros fichiers XLSX ONLYOFFICE.

## Règles importantes

- Les fichiers binaires ne sont jamais stockés dans PostgreSQL.
- Les documents sont servis uniquement via API authentifiée.
- Les controllers restent minces et délèguent aux services.
- Les DTOs sont séparés des entités.
