# Schéma base de données

La migration initiale est disponible dans `backend/src/Erp.Infrastructure/Persistence/Migrations`.

## Tables principales MVP

- `Users`, `Roles`, `Permissions`, `UserRoles`, `RefreshTokens`, `AuditLogs`.
- `Customers`, `CustomerContacts`, `CustomerAddresses`.
- `Products`, `ProductCategories`, `ProductSuppliers`.
- `Quotes`, `QuoteLines`, `QuoteDocuments`, `QuoteStatusHistories`.
- `DriveFolders`, `DriveItems`, `DriveFileVersions`, `DrivePermissions`, `DriveShares`, `DriveActivityLogs`, `DocumentLinks`.
- `Notifications`, `NotificationPreferences`.

## Documents

PostgreSQL stocke uniquement les métadonnées :

- nom de fichier
- type MIME
- taille
- chemin de stockage relatif
- version
- date
- liens métiers
- permissions prévues

Le contenu binaire est stocké dans le volume `oceanerp_documents`.

## Évolutions prévues

Les phases suivantes ajouteront les tables opérationnelles complètes pour stock, commandes, factures, achats, SAV, emails, agenda, signatures, PrestaShop, Factur-X et API keys.

## Tables Phase 2

La migration `Phase2Core` ajoute le socle :

- `Warehouses`, `StockItems`, `StockMovements`
- `SalesOrders`, `SalesOrderLines`, `SalesOrderStatusHistories`
- `Invoices`, `InvoiceLines`, `InvoicePayments`, `InvoiceDocuments`, `InvoiceStatusHistories`
- `MailAccounts`, `EmailMessages`, `EmailAttachments`, `EmailLinks`, `EmailTemplates`
- `PrestashopConnections`, `PrestashopSyncLogs`, `ExternalReferences`
