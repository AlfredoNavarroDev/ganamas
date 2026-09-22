# SAP hermana — Backend

API NestJS para el registro de ventas y compras de dos negocios (frutas y ropa),
con corte semanal y KPIs de rentabilidad. Ver
`../sap-hermana-backend/CLAUDE.md` para las decisiones de dominio y reglas de
negocio ya cerradas, y `../docs/superpowers/specs/2026-09-21-sap-hermana-backend-design.md`
para el diseño de implementación.

## Stack

NestJS 11 · TypeORM · PostgreSQL · JWT (`passport-jwt`) · `class-validator` ·
`decimal.js` para aritmética monetaria · Swagger (`@nestjs/swagger`).

## Requisitos

- Node.js 20+
- PostgreSQL 14+ corriendo localmente (o accesible vía `DATABASE_URL`)

## Variables de entorno

Copiar `.env.example` a `.env` y completar:

| Variable | Descripción | Default |
|---|---|---|
| `DATABASE_URL` | Cadena de conexión Postgres | — |
| `JWT_SECRET` | Secreto para firmar JWT | — |
| `JWT_EXPIRES_IN` | Duración del token (sin refresh, app de un solo usuario) | `30d` |
| `SEED_USERNAME` | Usuario único de la app | — |
| `SEED_PASSWORD` | Password del usuario único | — |
| `LOW_STOCK_THRESHOLD` | Umbral global de alerta de stock bajo en `/reports/kpis` | `5` |
| `PORT` | Puerto HTTP | `3000` |
| `NODE_ENV` | `development` habilita logging SQL y Swagger | — |

## Setup

```bash
npm install
npm run migration:run
npm run seed:user
```

El seed de los 2 negocios iniciales ("Frutas", "Ropa") se hace manualmente vía
`POST /businesses` una vez logueado — no es una migración ni parte de este
script, es dato inicial de negocio.

## Correr

```bash
npm run start:dev   # desarrollo con recarga en caliente
npm run start:prod  # producción (requiere npm run build antes)
```

Documentación interactiva de la API (deshabilitada en `NODE_ENV=production`):
`http://localhost:3000/api/docs`

## Tests

```bash
npm test           # unitarios
npm run test:e2e   # e2e — requiere Postgres migrado y sembrado (ver Setup)
npm run test:cov   # cobertura
```

## Login

Único endpoint público: `POST /auth/login`. No hay registro público — el
usuario se crea/actualiza solo vía `npm run seed:user`. Todas las demás rutas
requieren `Authorization: Bearer <token>`.
