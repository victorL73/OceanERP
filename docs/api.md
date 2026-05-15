# API

Swagger est activé en environnement `Development`.

## Endpoints MVP

- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `PUT /api/auth/me`
- `POST /api/auth/change-password`
- `GET /api/users`
- `POST /api/users`
- `PUT /api/users/{id}/roles`
- `GET /api/users/roles`
- `POST /api/users/roles`
- `PUT /api/users/roles/{id}`
- `GET /api/users/permissions`
- `GET /api/customers`
- `POST /api/customers`
- `GET /api/products`
- `POST /api/products`
- `GET /api/quotes`
- `POST /api/quotes`
- `GET /api/quotes/settings`
- `PUT /api/quotes/settings`
- `POST /api/quotes/settings/logo`
- `DELETE /api/quotes/settings/logo`
- `POST /api/quotes/{id}/pdf`
- `GET /api/quotes/{id}/documents/{documentId}/download`
- `GET /api/drive/folders`
- `POST /api/drive/folders`
- `GET /api/drive/files`
- `POST /api/drive/files`
- `GET /api/drive/files/{id}/download`
- `GET /api/notifications`
- `POST /api/notifications`
- `GET /api/dashboard/summary`
- `GET /api/health`

## Endpoints Phase 2 ajoutes

- `GET /api/orders`
- `POST /api/orders`
- `POST /api/orders/from-quote`
- `POST /api/orders/{id}/status`
- `GET /api/invoices`
- `POST /api/invoices/from-order`
- `POST /api/invoices/{id}/payments`
- `POST /api/invoices/{id}/pdf`
- `GET /api/invoices/{invoiceId}/documents/{documentId}/download`
- `GET /api/stock/warehouses`
- `POST /api/stock/warehouses`
- `GET /api/stock/items`
- `GET /api/stock/movements`
- `POST /api/stock/adjustments`
- `GET /api/emails/server-settings`
- `PUT /api/emails/server-settings`
- `GET /api/emails/accounts`
- `POST /api/emails/accounts`
- `PUT /api/emails/accounts/{id}`
- `DELETE /api/emails/accounts/{id}`
- `POST /api/emails/accounts/{id}/test-smtp`
- `POST /api/emails/accounts/{id}/sync-imap`
- `GET /api/emails/messages`
- `GET /api/emails/messages/{id}`
- `POST /api/emails/messages/{id}/read`
- `GET /api/emails/messages/{messageId}/attachments/{attachmentId}/download`
- `POST /api/emails/send`
- `GET /api/emails/templates`
- `POST /api/emails/templates`
- `PUT /api/emails/templates/{id}`
- `DELETE /api/emails/templates/{id}`
- `GET /api/prestashop/connections`
- `POST /api/prestashop/connections`
- `PUT /api/prestashop/connections/{id}`
- `GET /api/prestashop/sync-logs`
- `POST /api/prestashop/connections/{id}/sync`

## SignalR

Hub : `/hubs/notifications`

Événement client : `notificationCreated`

## Sécurité API

Les routes métier exigent un JWT. Les politiques d'autorisation utilisent les claims `permission`, par exemple `customers.read` ou `quotes.write`.

Les endpoints `GET /api/auth/me`, `PUT /api/auth/me` et `/api/auth/change-password` concernent le compte connecte. Les endpoints `/api/users/*` sont reserves aux comptes disposant de `auth.users.read` ou `auth.users.write`, donc typiquement aux administrateurs.

La Phase 2 ajoute les permissions `orders.*`, `invoices.*`, `stock.*`, `emails.*` et `prestashop.*`.

## Notes Phase 2

- Les commandes avec lignes produit peuvent etre confirmees puis expediees. La confirmation reserve le stock, l'expedition decremente le stock physique.
- Une facture ne peut etre creee que depuis une commande `Shipped` ou `Completed`.
- `POST /api/invoices/{id}/pdf` genere un PDF facture via QuestPDF et stocke uniquement ses metadonnees en PostgreSQL.
- Le module email se configure dans `Parametres > Boites mail`. Les administrateurs gerent les serveurs SMTP/IMAP globaux, creent les boites, renseignent l'adresse, le mot de passe ou le secret, et affectent les utilisateurs autorises.
- Les utilisateurs autorises ne voient dans l'onglet Emails et dans l'envoi des devis que les boites auxquelles ils ont acces. Ils peuvent ajuster les informations non sensibles de leur boite, notamment la signature HTML.
- Le module email journalise les envois, stocke les pieces jointes hors PostgreSQL et permet la synchronisation IMAP. L'envoi SMTP reel est active seulement si `Email:EnableSmtpSending=true`; sinon l'email reste journalise avec le statut `Logged` et l'interface indique explicitement qu'il n'a pas ete envoye.
- `POST /api/emails/accounts/{id}/test-smtp` teste toujours la connexion et l'authentification SMTP de la boite, meme si l'envoi reel est desactive.
- L'envoi d'un devis ne passe le devis en statut envoye que si le mail est effectivement parti avec le statut `Sent`.
- Les emails entrants et sortants conservent les champs `Cc` et `Bcc` en metadonnees. Le SMTP envoie les destinataires Cci par enveloppe sans les afficher dans les entetes du message emis.
- Les mots de passe SMTP/IMAP peuvent etre stockes chiffres en base avec `Secrets:EncryptionKey`, ou references par un secret d'environnement via `PasswordSecretName`. Les signatures HTML sont ajoutees automatiquement aux emails sortants.
- Les administrateurs configurent la personnalisation des devis dans `Parametres > Devis` : nom et adresse de l'entreprise, telephone, email, site, TVA/SIRET, mentions, pied de page et logo. Le logo est stocke hors PostgreSQL dans le stockage documents.
- La cle API PrestaShop est configuree dans `Parametres` par un administrateur et stockee sous forme protegee. La page PrestaShop sert a consulter l'etat et lancer les synchronisations.
- L'URL PrestaShop peut etre saisie sous forme `https://boutique.example.com` ou `https://boutique.example.com/api`. Le backend evite automatiquement le doublon `/api/api`.
- `POST /api/prestashop/connections/{id}/sync` cree un journal `Queued` et retourne immediatement. Un worker serveur passe ensuite le journal en `Running`, puis importe les produits, clients, stocks et commandes dans les modules ERP via `ExternalReference`.
- Le statut final est `Completed`, `CompletedWithWarnings` ou `Failed`, avec le nombre de creations/mises a jour par ressource PrestaShop.
