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

## Modules préparés

Les entités de vocabulaire des phases 2/3 sont placées dans `Erp.Domain/FutureModules` comme placeholders structurés : commandes, factures, stock, achats, comptabilité, SAV, emails, agenda, signature interne, PrestaShop et API externe.

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
- connecteur PrestaShop avec configuration protegee de cle API, import produits/clients/stocks/commandes, publication des modifications produits/clients/stocks et journal de synchronisation.

Les sujets volontairement reportes en Phase 3 restent : SAV avance, agenda, signature electronique interne, ONLYOFFICE avance, generation conforme Factur-X PDF/A-3 + XML embarque, exports comptables complets et application Electron avancee.

## Règles importantes

- Les fichiers binaires ne sont jamais stockés dans PostgreSQL.
- Les documents sont servis uniquement via API authentifiée.
- Les controllers restent minces et délèguent aux services.
- Les DTOs sont séparés des entités.
