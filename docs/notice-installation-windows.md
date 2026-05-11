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
.\build-installer.ps1 -ServerUrl "http://192.168.68.70:8080"
```

Le resultat est genere par `electron-builder` dans le dossier `desktop/dist`.

## Connexion

L'application Electron charge l'URL serveur fournie par `-ServerUrl`. Cette URL est embarquee dans `desktop/config/default-server.json` au moment du build.

L'utilisateur peut ensuite changer l'URL depuis le menu :

```text
OceanERP > Configurer le serveur
```

Le reglage est conserve dans le profil utilisateur Windows de l'application.

## Test local rapide

Avant de creer l'installateur, on peut tester le shell Electron :

```powershell
cd deploy/windows
.\test-desktop.ps1 -ServerUrl "http://192.168.68.70:8080"
```

Verifier :

- la fenetre OceanERP s'ouvre ;
- l'ecran de connexion charge le serveur Ubuntu ;
- le menu `OceanERP > Configurer le serveur` permet de changer l'URL ;
- une URL invalide affiche une page de diagnostic ;
- les notifications Windows sont autorisees par le systeme.

## Limite actuelle

Le shell Electron ne gere pas encore les mises a jour automatiques. L'icone finale `.ico` peut remplacer `desktop/assets/icon.svg` avant diffusion officielle.
