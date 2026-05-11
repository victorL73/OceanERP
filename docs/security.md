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
- Etendre le stockage chiffre aux secrets SMTP/IMAP/API keys externes qui ne sont pas encore en coffre applicatif.
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
