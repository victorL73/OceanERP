# API

Swagger est activé en environnement `Development`.

## Endpoints MVP

- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/users`
- `POST /api/users`
- `GET /api/users/roles`
- `GET /api/customers`
- `POST /api/customers`
- `GET /api/products`
- `POST /api/products`
- `GET /api/quotes`
- `POST /api/quotes`
- `POST /api/quotes/{id}/pdf`
- `GET /api/quotes/{id}/documents/{documentId}/download`
- `GET /api/drive/folders`
- `POST /api/drive/folders`
- `GET /api/drive/files`
- `POST /api/drive/files`
- `GET /api/drive/files/{id}/download`
- `GET /api/notifications`
- `POST /api/notifications`
- `GET /api/dashboard/summary`
- `GET /api/health`

## SignalR

Hub : `/hubs/notifications`

Événement client : `notificationCreated`

## Sécurité API

Les routes métier exigent un JWT. Les politiques d'autorisation utilisent les claims `permission`, par exemple `customers.read` ou `quotes.write`.

