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
- `GET /api/users/audit-logs`
- `GET /api/customers`
- `POST /api/customers`
- `PUT /api/customers/{id}`
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
- `PUT /api/drive/folders/{id}/rename`
- `PUT /api/drive/folders/{id}/move`
- `DELETE /api/drive/folders/{id}`
- `POST /api/drive/folders/{id}/restore`
- `GET /api/drive/files`
- `POST /api/drive/files`
- `GET /api/drive/files/{id}/download`
- `PUT /api/drive/files/{id}/rename`
- `PUT /api/drive/files/{id}/move`
- `DELETE /api/drive/files/{id}`
- `POST /api/drive/files/{id}/restore`
- `GET /api/drive/links/{module}/{entityId}`
- `POST /api/drive/links`
- `DELETE /api/drive/links/{id}`
- `GET /api/notifications`
- `POST /api/notifications`
- `GET /api/dashboard/summary`
- `GET /api/health`

## Endpoints Phase 2 ajoutes

- `GET /api/orders`
- `GET /api/orders/{id}`
- `POST /api/orders`
- `POST /api/orders/from-quote`
- `POST /api/orders/{id}/status`
- `GET /api/orders/{id}/shipment-slip`
- `GET /api/orders/{id}/colissimo-label`
- `GET /api/invoices`
- `GET /api/invoices/{id}`
- `POST /api/invoices/from-order`
- `POST /api/invoices/{id}/payments`
- `POST /api/invoices/{id}/cancel`
- `POST /api/invoices/{id}/pdf`
- `GET /api/invoices/{invoiceId}/documents/{documentId}/download`
- `GET /api/purchases/orders`
- `GET /api/purchases/orders/{id}`
- `POST /api/purchases/orders`
- `PUT /api/purchases/orders/{id}`
- `POST /api/purchases/orders/{id}/status`
- `PUT /api/purchases/orders/{id}/expected-date`
- `PUT /api/purchases/orders/{id}/warehouse`
- `POST /api/purchases/orders/{id}/receive-to-stock`
- `GET /api/stock/warehouses`
- `POST /api/stock/warehouses`
- `PUT /api/stock/warehouses/{id}`
- `DELETE /api/stock/warehouses/{id}`
- `GET /api/stock/items`
- `GET /api/stock/movements`
- `POST /api/stock/adjustments`
- `PUT /api/stock/items/{id}`
- `GET /api/emails/server-settings`
- `PUT /api/emails/server-settings`
- `GET /api/emails/accounts`
- `POST /api/emails/accounts`
- `PUT /api/emails/accounts/{id}`
- `DELETE /api/emails/accounts/{id}`
- `POST /api/emails/accounts/{id}/test-smtp`
- `POST /api/emails/accounts/{id}/sync-imap`
- `POST /api/emails/sync-imap`
- `GET /api/emails/messages`
- `GET /api/emails/messages/{id}`
- `POST /api/emails/messages/{id}/read`
- `DELETE /api/emails/messages/{id}`
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
- `GET /api/orders/{id}/shipment-slip` genere le bon d'expedition ERP pour les commandes Colissimo.
- `GET /api/orders/{id}/colissimo-label` recupere l'etiquette Colissimo officielle si le module PrestaShop l'expose via API ou via `PRESTASHOP_COLISSIMO_LABEL_ENDPOINT_TEMPLATE`. Sinon l'API renvoie une erreur explicite et l'etiquette reste a generer dans PrestaShop.
- Une facture ne peut etre creee que depuis une commande `Shipped` ou `Completed`.
- Le statut facture expose par l'API devient automatiquement `Overdue` quand l'echeance est depassee et que le solde reste positif. `POST /api/invoices/{id}/cancel` annule une facture sans paiement et ajoute une entree dans l'historique de statut.
- `POST /api/invoices/{id}/pdf` genere un PDF facture via QuestPDF et stocke uniquement ses metadonnees en PostgreSQL.
- Les achats fournisseurs acceptent plusieurs lignes produit, uniquement rattachees au fournisseur et a l'entrepot choisis. Une commande recue peut etre injectee dans le stock via `POST /api/purchases/orders/{id}/receive-to-stock`, ce qui declenche aussi la publication stock PrestaShop lorsque le produit dispose d'une reference externe.
- Le module email se configure dans `Parametres > Boites mail`. Les administrateurs gerent les serveurs SMTP/IMAP globaux, creent les boites, renseignent l'adresse, le mot de passe ou le secret, et affectent les utilisateurs autorises.
- Les utilisateurs autorises ne voient dans l'onglet Emails et dans l'envoi des devis que les boites auxquelles ils ont acces. Ils peuvent ajuster les informations non sensibles de leur boite, notamment la signature HTML.
- Le module email journalise les envois, stocke les pieces jointes hors PostgreSQL et permet la synchronisation IMAP. L'envoi SMTP reel est active seulement si `Email:EnableSmtpSending=true`; sinon l'email reste journalise avec le statut `Logged` et l'interface indique explicitement qu'il n'a pas ete envoye.
- La releve IMAP automatique est pilotee par `Parametres > Boites mail`. L'intervalle est en minutes; la valeur `0` active un mode rapide serveur toutes les 15 secondes. L'onglet Emails lance aussi une actualisation automatique courte tant qu'il est ouvert et visible.
- `POST /api/emails/accounts/{id}/test-smtp` teste toujours la connexion et l'authentification SMTP de la boite, meme si l'envoi reel est desactive.
- L'envoi d'un devis passe le devis en statut envoye quand l'email est `Sent`. En environnement sans SMTP reel (`Email:EnableSmtpSending=false`), le statut `Logged` est accepte pour permettre les tests et le workflow de validation, avec une trace explicite dans l'historique du devis.
- Les emails entrants et sortants conservent les champs `Cc` et `Bcc` en metadonnees. Le SMTP envoie les destinataires Cci par enveloppe sans les afficher dans les entetes du message emis.
- `DELETE /api/emails/messages/{id}` supprime logiquement le mail de l'ERP. Le message reste marque en base pour que la synchronisation IMAP ne le reimporte pas lors des prochains rafraichissements.
- Les mots de passe SMTP/IMAP peuvent etre stockes chiffres en base avec `Secrets:EncryptionKey`, ou references par un secret d'environnement via `PasswordSecretName`. Les signatures HTML sont ajoutees automatiquement aux emails sortants.
- Les administrateurs configurent la personnalisation des devis dans `Parametres > Devis` : nom et adresse de l'entreprise, telephone, email, site, TVA/SIRET, mentions, pied de page et logo. Le logo est stocke hors PostgreSQL dans le stockage documents.
- La cle API PrestaShop est configuree dans `Parametres` par un administrateur et stockee sous forme protegee. La page PrestaShop sert a consulter l'etat et lancer les synchronisations.
- `PUT /api/customers/{id}` met a jour la fiche ERP et, si le client possede une reference externe PrestaShop, publie aussi la fiche client et sa premiere adresse PrestaShop liee. En cas d'echec PrestaShop, la modification ERP est refusee pour eviter une divergence silencieuse.
- La fiche client accepte les champs administratifs et commerciaux : raison sociale, nom commercial, SIREN, SIRET, TVA, email, telephone, mobile, site web, secteur, type, origine, code comptable, conditions de paiement et remise par defaut.
- L'URL PrestaShop peut etre saisie sous forme `https://boutique.example.com` ou `https://boutique.example.com/api`. Le backend evite automatiquement le doublon `/api/api`.
- `POST /api/prestashop/connections/{id}/sync` cree un journal `Queued` et retourne immediatement. Un worker serveur passe ensuite le journal en `Running`, puis importe les produits, clients, stocks et commandes dans les modules ERP via `ExternalReference`.
- Le statut final est `Completed`, `CompletedWithWarnings` ou `Failed`, avec le nombre de creations/mises a jour par ressource PrestaShop.
