# OceanERP

OceanERP est un socle ERP modulaire en Clean Architecture pour ASP.NET Core, PostgreSQL, React, Electron, SignalR, QuestPDF et ONLYOFFICE Docs.

## Structure

- `backend/src/Erp.Domain` : entites metier et regles de domaine.
- `backend/src/Erp.Application` : DTOs, contrats de services, cas applicatifs exposes.
- `backend/src/Erp.Infrastructure` : EF Core PostgreSQL, stockage fichiers, PDF, JWT, services.
- `backend/src/Erp.Api` : REST API, JWT, SignalR, Swagger, middleware.
- `frontend` : React TypeScript + Vite + PWA.
- `desktop` : shell Electron Windows.
- `docker` : Docker Compose, Nginx, PostgreSQL, ONLYOFFICE.
- `deploy` : scripts Ubuntu et build Windows.
- `docs` : documentation technique en francais.

## Lancement backend local

```bash
dotnet restore OceanERP.slnx
dotnet tool restore
dotnet test OceanERP.slnx
dotnet run --project backend/src/Erp.Api/Erp.Api.csproj
```

Compte seed local :

- email : `admin@oceanerp.local`
- mot de passe : `ChangeMe!12345`

## Lancement frontend

```bash
cd frontend
npm install
npm run dev
```

## Docker Ubuntu

Chemin principal :

```bash
cd ~/OceanERP/deploy/ubuntu
chmod +x *.sh
cp .env.example .env
nano .env
./install-prerequisites.sh
./setup-server.sh
./deploy.sh
```

Test apres deploiement :

```bash
docker compose --env-file .env -f docker-compose.yml ps
curl http://localhost:8080/api/health
```

Acces navigateur :

```text
http://IP_DU_SERVEUR:8080
```

Documentation detaillee :

- `docs/notice-deploiement-ubuntu.md`
- `docs/notice-sauvegarde-restauration.md`
- `docs/notice-mise-a-jour.md`

## Sauvegarde

```bash
cd ~/OceanERP/deploy/ubuntu
./backup.sh
ls -lh /opt/oceanerp/backups
gzip -t /opt/oceanerp/backups/YYYYMMDDTHHMMSSZ/postgres.sql.gz
tar -tzf /opt/oceanerp/backups/YYYYMMDDTHHMMSSZ/documents.tar.gz
```

## Windows Electron

```powershell
cd deploy/windows
.\build-installer.ps1 -ServerUrl "https://erp.example.com"
```

Le script prepare l'installateur via `electron-builder`; il ne cree un `.exe` que lorsque les dependances Node sont installees et que la commande aboutit.

