# OceanERP

OceanERP est un socle ERP modulaire en Clean Architecture pour ASP.NET Core, PostgreSQL, React, Electron, SignalR, QuestPDF et ONLYOFFICE Docs.

## Structure

- `backend/src/Erp.Domain` : entités métier et règles de domaine.
- `backend/src/Erp.Application` : DTOs, contrats de services, cas applicatifs exposés.
- `backend/src/Erp.Infrastructure` : EF Core PostgreSQL, stockage fichiers, PDF, JWT, services.
- `backend/src/Erp.Api` : REST API, JWT, SignalR, Swagger, middleware.
- `frontend` : React TypeScript + Vite + PWA.
- `desktop` : shell Electron Windows.
- `docker` : Docker Compose, Nginx, PostgreSQL, ONLYOFFICE.
- `deploy` : scripts Ubuntu et build Windows.
- `docs` : documentation technique en français.

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

```bash
cd deploy/ubuntu
cp .env.example .env
./install-prerequisites.sh
./setup-server.sh
./deploy.sh
```

## Windows Electron

```powershell
cd deploy/windows
.\build-installer.ps1 -ServerUrl "https://erp.example.com"
```

Le script prépare l'installateur via `electron-builder`; il ne crée un `.exe` que lorsque les dépendances Node sont installées et que la commande aboutit.

