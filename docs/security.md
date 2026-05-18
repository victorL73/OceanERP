# Sécurité et RGPD

## Implémenté dans le socle

- JWT Bearer.
- Refresh tokens hashés en SHA-256.
- Hash des mots de passe via `PasswordHasher<TUser>`.
- RBAC et permissions granulaires.
- Gestion admin des comptes, roles et permissions par module.
- Espace utilisateur pour modifier email, nom affiche et mot de passe.
- Revocation des refresh tokens actifs apres changement de mot de passe.
- Cle API PrestaShop configurable uniquement depuis `Parametres` par un compte ayant `prestashop.write`, avec stockage chiffre en base via `Secrets:EncryptionKey`.
- Serveurs SMTP/IMAP globaux configurables uniquement par un administrateur dans `Parametres > Boites mail`.
- Boites mail creees par un administrateur : adresse, mot de passe ou secret sont geres par l'admin, puis les utilisateurs autorises peuvent utiliser la boite et maintenir une signature HTML.
- Mots de passe de boites mail stockes sous forme protegee avec `Secrets:EncryptionKey` ou references par secret d'environnement.
- Personnalisation des devis reservee aux administrateurs : logo stocke hors base de donnees, metadonnees uniquement en PostgreSQL.
- Signature electronique interne tracee : lien unique, token hash en base, expiration, acceptation des conditions, hash SHA-256 du document, IP, user-agent, horodatage et preuve.
- ONLYOFFICE integre via callback serveur, avec versioning Drive et stockage fichier hors PostgreSQL.
- Audit logs de connexion.
- Middleware centralisé d'erreurs.
- CORS configurable.
- Rate limiting global.
- Documents servis par API uniquement.
- Stockage fichiers hors base de données.
- Logs structurés Serilog.

## À renforcer avant production

- Remplacer tous les secrets `.env`.
- Activer HTTPS via Nginx et Certbot ou un reverse proxy TLS managé.
- Définir une politique de rotation des refresh tokens.
- Ajouter verrouillage de compte et 2FA.
- Activer l'OTP email obligatoire sur les signatures publiques.
- Ajouter un jeton temporaire signe pour les URLs de document ONLYOFFICE et verifier le JWT de callback OnlyOffice.
- Finaliser Factur-X conforme : profil EN16931, PDF/A-3 et XML embarque.
- Etendre le coffre applicatif aux futurs secrets API externes qui ne sont pas encore couverts.
- Compléter les permissions Drive par dossier/fichier.
- Ajouter antivirus ou sandbox d'analyse documentaire si nécessaire.

## RGPD

Le socle prévoit :

- journalisation des accès via `AuditLogs`
- rattachement documentaire par métadonnées
- suppression logique possible côté Drive
- base pour export client
- base pour anonymisation client
- durées de conservation à paramétrer par module

À implémenter en phase RGPD complète :

- endpoint d'export des données client
- endpoint d'anonymisation
- registre de consentements
- politiques de rétention configurables
- revue des droits d'accès par rôle
