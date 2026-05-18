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

## Phase 2 demarree

La Phase 2 dispose maintenant d'un socle backend/API pour :

- commandes clients avec creation manuelle ou depuis devis
- workflow commande `Draft -> Confirmed -> Preparing/Shipped -> Completed/Cancelled`
- reservation de stock a la confirmation et decrementation a l'expedition
- factures depuis commande expediee, paiements et prevention des doubles facturations
- PDF facture QuestPDF stocke hors base de donnees
- stock par entrepot avec mouvements d'ajustement, reservation, liberation et expedition
- comptes email, journal de messages et envoi SMTP optionnel via MailKit
- connexions PrestaShop et journal de synchronisation manuelle

Les workflows avances restent a enrichir : achats fournisseurs, reception marchandise, synchronisation IMAP, connecteur PrestaShop complet, exports comptables, avoirs, Factur-X et parametrage fin des regles de stock.

## Règles importantes

- Les fichiers binaires ne sont jamais stockés dans PostgreSQL.
- Les documents sont servis uniquement via API authentifiée.
- Les controllers restent minces et délèguent aux services.
- Les DTOs sont séparés des entités.
