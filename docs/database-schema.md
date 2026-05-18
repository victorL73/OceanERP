# Schéma base de données

La migration initiale est disponible dans `backend/src/Erp.Infrastructure/Persistence/Migrations`.

## Tables principales MVP

- `Users`, `Roles`, `Permissions`, `UserRoles`, `RefreshTokens`, `AuditLogs`.
- `Customers`, `CustomerContacts`, `CustomerAddresses`.
  La fiche client stocke les informations commerciales et administratives utiles : nom societe, raison sociale, nom commercial, SIREN, SIRET, TVA, email, telephone, mobile, site web, secteur, type client, origine, code comptable, conditions de paiement et remise par defaut.
- `Products`, `ProductCategories`, `ProductSuppliers`.
- `Quotes`, `QuoteLines`, `QuoteDocuments`, `QuoteStatusHistories`.
- `QuoteDocumentSettings` pour la personnalisation PDF des devis.
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

## Evolutions prevues

La Phase 2 est cloturee sur les tables operationnelles de commandes, factures, stock, achats, emails et PrestaShop. Les phases suivantes ajouteront les tables completes pour SAV, agenda, signature interne, exports comptables avances, Factur-X et API keys externes.

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

La migration `EmailCcBcc` ajoute :

- `EmailMessages.Cc` et `EmailMessages.Bcc` pour conserver les copies et copies cachees en metadonnees email.

La migration `EmailSoftDelete` ajoute :

- `EmailMessages.IsDeleted` et `EmailMessages.DeletedAt` pour masquer un email sans supprimer son identifiant IMAP externe.
- L'index `MailAccountId/IsDeleted` pour filtrer rapidement les journaux de mails actifs.

La migration `QuoteDocumentSettings` ajoute :

- `QuoteDocumentSettings` pour stocker les metadonnees d'identite entreprise utilisees sur les PDF de devis.
- `LogoStoragePath`, `LogoFileName`, `LogoMimeType`, `LogoSize` pour rattacher un logo stocke hors base de donnees.

La migration `PrestashopProtectedApiKey` ajoute :

- `PrestashopConnections.ApiKeyProtectedValue` pour stocker la cle API PrestaShop sous forme protegee, sans exposer la valeur en clair dans les listes API.

La migration `PrestashopSyncExecutionLog` ajoute :

- `PrestashopSyncLogs.Message`, `StartedAt` et `CompletedAt` pour suivre la file de synchronisation PrestaShop et diagnostiquer les etats `Queued`, `Running`, `Completed` et `Failed`.

Les migrations Phase 2 suivantes completent les usages terrain :

- `ProductImageUrl` et `ProductBrands` ajoutent les images catalogue et la marque issue de PrestaShop.
- `PrestashopWarehouseAssignment` et `PrestashopAllWarehousesByDefault` rattachent les stocks ERP aux connexions PrestaShop tout en laissant les produits changer d'entrepot.
- `WarehouseContactDetails` enrichit les entrepots avec adresse, representant, telephone, email et notes.
- `PurchaseOrdersAndLowStockAlerts`, `PurchaseOrderMultiLineCharges` et `PurchaseOrderReceivingWarehouse` ajoutent les commandes fournisseurs, leurs lignes, frais annexes, commentaires, date de reception et entrepot de reception.
- `EmailAutoSyncSettings` ajoute le rafraichissement IMAP automatique configurable par compte.
- `CustomerProfileFields` ajoute les champs utiles sur les clients : raison sociale, nom commercial, SIREN/SIRET, TVA, telephones, site, origine, code comptable, conditions de paiement, remise et notes.
- `SalesOrderShippingDetails` et `SalesOrderPrestashopDetails` ajoutent les informations boutique, livraison, paiement, facture et transporteur necessaires au detail commande et aux documents d'expedition.

Les factures conservent l'historique dans `InvoiceStatusHistories`. Le statut `Overdue` est calcule par l'API a partir de `DueDate` et du solde restant, sans dupliquer cet etat derive en base.
