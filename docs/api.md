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
- `GET /api/emails/accounts`
- `POST /api/emails/accounts`
- `GET /api/emails/messages`
- `POST /api/emails/send`
- `GET /api/prestashop/connections`
- `POST /api/prestashop/connections`
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
- Le module email journalise les envois. L'envoi SMTP reel est active seulement si `Email:EnableSmtpSending=true` et si le secret du mot de passe SMTP est present en configuration.
