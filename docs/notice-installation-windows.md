# Notice installation Windows

## Prerequis

Installer Node.js LTS avec npm sur la machine de build Windows :

```powershell
winget install OpenJS.NodeJS.LTS
```

Fermer puis rouvrir PowerShell, puis verifier :

```powershell
node --version
npm --version
```

## Generer l'installateur

Depuis une machine Windows avec Node.js et npm :

```powershell
cd deploy/windows
.\build-installer.ps1
```

Le resultat est genere par `electron-builder` dans le dossier `desktop/dist`.

Optionnel : pour pre-remplir l'adresse serveur dans l'ecran de demarrage, utiliser :

```powershell
.\build-installer.ps1 -ServerUrl "http://IP_DU_SERVEUR:8080"
```

## Connexion et choix du serveur

Au demarrage, l'application Windows affiche d'abord un ecran local `Connexion au serveur`.
L'utilisateur saisit l'adresse du serveur OceanERP, par exemple :

```text
http://192.168.68.70:8080
```

Ensuite seulement, l'application charge l'ecran d'identification du serveur choisi.

Sans parametre `-ServerUrl`, aucune adresse serveur n'est embarquee dans l'installateur. L'URL fournie par `-ServerUrl` sert uniquement de valeur pre-remplie par defaut. Elle est embarquee dans `desktop/config/default-server.json` au moment du build, mais l'utilisateur peut la changer sans reconstruire le `.exe`.

L'utilisateur peut ensuite changer l'URL depuis le menu :

```text
OceanERP > Changer de serveur
```

Le reglage est conserve dans le profil utilisateur Windows de l'application.

## Test local rapide

Avant de creer l'installateur, on peut tester le shell Electron :

```powershell
cd deploy/windows
.\test-desktop.ps1
```

Optionnel : `.\test-desktop.ps1 -ServerUrl "http://IP_DU_SERVEUR:8080"` pre-remplit l'adresse pendant le test.

Verifier :

- la fenetre OceanERP s'ouvre ;
- l'ecran `Connexion au serveur` apparait avant la connexion utilisateur ;
- l'adresse du serveur peut etre modifiee sans rebuild ;
- l'ecran de connexion ERP charge le serveur Ubuntu apres validation ;
- le menu `OceanERP > Changer de serveur` permet de revenir au choix serveur ;
- une URL invalide affiche une page de diagnostic ;
- les notifications Windows sont autorisees par le systeme.

## Limite actuelle

Le shell Electron ne gere pas encore les mises a jour automatiques. L'icone finale `.ico` peut remplacer `desktop/assets/icon.svg` avant diffusion officielle.
