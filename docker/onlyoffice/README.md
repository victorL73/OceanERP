ONLYOFFICE Docs is exposed behind Nginx under `/onlyoffice/`. Use `ONLYOFFICE_JWT_SECRET` in production and keep it aligned with the ERP callback configuration.

OceanERP gives Document Server an internal Docker URL such as `http://erp-api:8080` to download and save Drive files. Keep `ONLYOFFICE_ALLOW_PRIVATE_IP_ADDRESS=true` in Docker Compose; without it, Document Server can show `errorCode -4` / download failed when it refuses private network addresses.
