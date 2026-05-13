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
- `MailServerSettings`, `MailAccounts`, `MailAccountAccesses`, `EmailMessages`, `EmailAttachments`, `EmailLinks`, `EmailTemplates`
- `PrestashopConnections`, `PrestashopSyncLogs`, `ExternalReferences`

La migration `Phase2Workflows` complete ce socle :

- `StockItems.QuantityReserved` pour distinguer stock physique et stock reserve.
- `StockMovements.Type`, `ReferenceModule`, `ReferenceId` pour tracer ajustements, reservations, liberations et expeditions.
- `SalesOrders.WarehouseId` et dates de workflow (`ConfirmedAt`, `ShippedAt`, `CompletedAt`, `CancelledAt`).
- `SalesOrderLines.ProductId` pour relier les commandes au stock produit.
- `Invoices.SalesOrderId`, `IssueDate`, `DueDate` et index unique pour eviter de facturer deux fois la meme commande.
- `InvoiceDocuments` recoit les metadonnees completes des PDF facture.
- `MailAccounts` recoit les ports SMTP/IMAP, SSL, utilisateur et nom de secret.
- `EmailMessages` recoit corps, direction, statut, lu/non lu et date d'envoi.

La migration `EmailModuleCompletion` finalise le module email :

- `MailServerSettings` stocke les hotes SMTP/IMAP globaux geres par les administrateurs.
- `MailAccounts` recoit le nom affiche, la signature HTML, l'etat actif, le mot de passe protege et les donnees serveur recopiees pour compatibilite.
- `MailAccountAccesses` relie les boites generiques aux utilisateurs autorises.
- `EmailMessages` rattache chaque message a une boite, stocke l'identifiant IMAP externe, les erreurs et la date de reception.
- `EmailAttachments` stocke uniquement les metadonnees; le binaire reste dans le stockage documents.

La migration `PrestashopProtectedApiKey` ajoute :

- `PrestashopConnections.ApiKeyProtectedValue` pour stocker la cle API PrestaShop sous forme protegee, sans exposer la valeur en clair dans les listes API.

La migration `PrestashopSyncExecutionLog` ajoute :

- `PrestashopSyncLogs.Message`, `StartedAt` et `CompletedAt` pour suivre la file de synchronisation PrestaShop et diagnostiquer les etats `Queued`, `Running`, `Completed` et `Failed`.
