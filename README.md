# SAP hermana

Sistema de registro de ventas y compras para dos negocios (frutas y ropa),
pensado para reemplazar el cuaderno físico que usa mi hermana. Prioriza
velocidad de registro de venta (mobile-first) y da corte semanal + KPIs de
rentabilidad (mejor día, mejor hora, producto más rentable, alerta de stock
bajo). Usuario único por instancia — pensado para ser replicable a otros
negocios/personas más adelante sin tocar código, solo datos.

## Stack

| Capa | Tech |
|---|---|
| Backend | NestJS 11 + TypeORM + PostgreSQL |
| Frontend | Next.js (App Router) + React 19 + Tailwind CSS 4 |
| Auth | JWT (`@nestjs/jwt` + `passport-jwt`), un solo usuario sembrado, sin registro público |
| Dinero/cantidades | `decimal.js` contra columnas `numeric` (nunca floats nativos) |
| DB hosting | PostgreSQL gestionado por Supabase |
| Docs de API | Swagger (`@nestjs/swagger`) en `/api/docs` |
| Package managers | `npm` en `/backend`, `pnpm` en `/frontend` (no mezclar) |

## Estructura del repo

```
backend/     API NestJS (auth, businesses, products, purchases, sales, reports)
frontend/    App Next.js — UI de registro rápido y reportes
docs/        Specs y planes de implementación (superpowers/specs, superpowers/plans)
sap-hermana-backend/  Referencia de reglas de dominio cerradas (CLAUDE.md) — no es código vivo
```

Las decisiones de negocio ya cerradas (modelo de datos, costo promedio
ponderado, control de stock, zona horaria de reportes, etc.) están
documentadas en `sap-hermana-backend/CLAUDE.md`. El diseño de implementación
del backend está en `docs/superpowers/specs/2026-09-21-sap-hermana-backend-design.md`
y el plan tarea-por-tarea en `docs/superpowers/plans/2026-09-21-sap-hermana-backend.md`.

## Estado

La implementación completa del backend (auth, los 5 módulos de dominio,
reportes con agregación consciente de la zona horaria de Lima, y Swagger) ya
está mergeada a `main`. El frontend aún es el scaffold por defecto de
`create-next-app`.

## Levantar todo con Docker (automático)

```bash
docker compose up -d --build
```

Esto levanta Postgres local, corre migraciones + seed del usuario único, y
arranca backend (`:3000`) y frontend (`:3001`) — sin pasos manuales. Login de
prueba: usuario `admin`, password `change-me` (defaults, ver abajo).

Los defaults funcionan sin configuración. Para cambiarlos, copiar `.env.example`
a `.env` en la raíz y editar (`POSTGRES_*`, `JWT_SECRET`, `SEED_USERNAME`,
`SEED_PASSWORD`, etc.) — nunca commitear ese `.env`, ya está en `.gitignore`.

`NODE_ENV=production` dentro de los contenedores implica que Swagger
(`/api/docs`) queda deshabilitado por diseño; para probar la API interactiva
usar `npm run start:dev` local (ver abajo) en vez de Docker.

```bash
docker compose down          # detiene todo, conserva los datos de Postgres
docker compose down -v       # detiene todo y borra también los datos
docker compose logs -f       # logs en vivo de los 3 servicios
```

## Desarrollo local (sin Docker)

```bash
# Backend
cd backend
npm install
npm run migration:run
npm run seed:user
npm run start:dev      # http://localhost:3000, docs en /api/docs

# Frontend
cd frontend
pnpm install
pnpm dev                # http://localhost:3000 (o el puerto libre siguiente)
```

Variables de entorno del backend (modo local, contra Supabase): ver
`backend/.env.example`.
