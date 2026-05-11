# Notice installation Windows

## Générer l'installateur

Depuis une machine Windows avec Node.js et npm :

```powershell
cd deploy/windows
.\build-installer.ps1 -ServerUrl "https://erp.example.com"
```

Le résultat est généré par `electron-builder` dans le dossier `desktop/dist`.

## Connexion

L'application Electron charge l'URL serveur configurée par `OCEANERP_WEB_URL` pendant le build ou par la valeur passée au script.

## Limite actuelle

Le shell Electron est initial. Les mises à jour automatiques, la configuration serveur graphique avancée et l'icône `.ico` finale sont prévues en phase suivante.

