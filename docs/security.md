# Sécurité et RGPD

## Mise a jour securite 2026-05-21

- Les cles PrestaShop sont gerees depuis `Parametres > PrestaShop` par un administrateur ; elles ne doivent pas etre dupliquees dans `.env` en production courante.
- Les parametres IA Groq sont geres depuis `Parametres > IA` par un administrateur. La cle API n'est jamais renvoyee par l'API ; elle peut etre protegee en base ou referencee par un secret serveur comme `GROQ_API_KEY`.
- Les mots de passe de boites mail et les secrets SFTP de sauvegarde sont proteges cote serveur et ne sont pas renvoyes en clair par l'API.
- Les sauvegardes peuvent etre copiees vers un stockage externe SFTP avec un compte dedie et un dossier distant limite.
- Meet expose une page invite publique separee : l'invite saisit seulement son nom et ne recoit aucun acces au reste de l'ERP.
- Les liens publics de signature et de Meet doivent rester des URLs a token non devinable, expirees ou invalidables selon le module.
- ONLYOFFICE utilise des URLs temporaires signees et un callback serveur ; une erreur `errorCode -4` indique generalement que Document Server ne peut pas joindre l'URL de telechargement.
- Les emails supprimes le sont logiquement pour eviter leur retour a la prochaine synchronisation IMAP.
- Les notifications recurrentes doivent etre regroupees par sujet metier et remises en non-lu au besoin, plutot que dupliquees chaque jour.
- Les justificatifs de notes de frais sont stockes hors PostgreSQL et telecharges uniquement via les endpoints controles par permissions.

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
- Parametrage IA reserve aux administrateurs, avec fournisseur Groq impose pour le socle actuel, validation de l'URL API, du modele, de la temperature et de la limite de tokens.
- Signature electronique interne tracee : lien unique, token hash en base, OTP email, expiration, acceptation des conditions, hash SHA-256 du document, IP, user-agent, horodatage et preuve.
- ONLYOFFICE integre via URL temporaire signee et callback serveur, avec versioning Drive et stockage fichier hors PostgreSQL.
- Audit logs de connexion.
- Middleware centralisé d'erreurs.
- CORS configurable.
- Rate limiting global.
- Documents servis par API uniquement.
- Justificatifs de notes de frais servis par API uniquement avec permissions `expenses.read`, `expenses.write` et `expenses.approve`; PostgreSQL ne conserve que les metadonnees.
- Stockage fichiers hors base de données.
- Logs structurés Serilog.

## À renforcer avant production

- Remplacer tous les secrets `.env`.
- Activer HTTPS via Nginx et Certbot ou un reverse proxy TLS managé.
- Définir une politique de rotation des refresh tokens.
- Ajouter verrouillage de compte et 2FA.
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
