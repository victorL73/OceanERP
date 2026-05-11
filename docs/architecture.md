# Architecture

OceanERP suit une Clean Architecture stricte.

## Couches

- `Erp.Domain` contient les entités, enums et règles métier pures. Aucune dépendance EF Core ou ASP.NET.
- `Erp.Application` contient les DTOs et interfaces de services. Les contrôleurs dépendent de cette couche.
- `Erp.Infrastructure` implémente les interfaces applicatives avec EF Core, PostgreSQL, JWT, QuestPDF et stockage disque.
- `Erp.Api` expose REST, SignalR, Swagger, CORS, rate limiting, middleware d'erreurs et authentification.

## Modules MVP

- Authentification JWT et refresh tokens.
- RBAC avec rôles et permissions granulaires.
- Clients.
- Produits, catégories et fournisseurs produits.
- Devis avec calculs, statuts et PDF QuestPDF.
- Drive simple avec dossiers, fichiers, versions et métadonnées.
- Notifications internes et hub SignalR.
- Dashboard de base.

## Modules préparés

Les entités de vocabulaire des phases 2/3 sont placées dans `Erp.Domain/FutureModules` comme placeholders structurés : commandes, factures, stock, achats, comptabilité, SAV, emails, agenda, signature interne, PrestaShop et API externe.

## Règles importantes

- Les fichiers binaires ne sont jamais stockés dans PostgreSQL.
- Les documents sont servis uniquement via API authentifiée.
- Les controllers restent minces et délèguent aux services.
- Les DTOs sont séparés des entités.

