ONLYOFFICE Docs is exposed behind Nginx under `/onlyoffice/`. Use `ONLYOFFICE_JWT_SECRET` in production and keep it aligned with the ERP callback configuration.

OceanERP gives Document Server an internal Docker URL through the Docker Nginx service, usually `http://nginx`, to download and save Drive files via `/api/onlyoffice/...`. Keep `ONLYOFFICE_ALLOW_PRIVATE_IP_ADDRESS=true` and `ONLYOFFICE_ALLOW_META_IP_ADDRESS=true` in Docker Compose; without them, Document Server can show `errorCode -4` / download failed when it refuses Docker private network addresses.
