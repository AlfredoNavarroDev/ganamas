# Ganamás

Sistema de registro de ventas y compras hecho para **Zuhhey**, mi hermana,
que maneja dos negocios (frutas y ropa) y hasta ahora anotaba todo en un
cuaderno físico. Ganamás reemplaza el cuaderno: prioriza velocidad de
registro de venta (mobile-first) y da corte semanal + KPIs de rentabilidad
(mejor día, mejor hora, producto más rentable, alerta de stock bajo).
Usuario único por instancia — pensado para ser replicable a otros
negocios/personas más adelante sin tocar código, solo datos.

## Stack

| Capa | Tech |
|---|---|
| Backend | NestJS 11 + TypeORM + PostgreSQL |
| Frontend | Next.js (App Router) + React 19 + Tailwind CSS 4 |
| Auth | JWT (`@nestjs/jwt` + `passport-jwt`), un solo usuario sembrado, sin registro público |
| Dinero/cantidades | `decimal.js` contra columnas `numeric` (nunca floats nativos) |
| DB hosting | PostgreSQL gestionado por Neon |
| Docs de API | Swagger (`@nestjs/swagger`) en `/api/docs` |
| Package managers | `npm` en `/backend`, `pnpm` en `/frontend` (no mezclar) |

## Estructura del repo

```
backend/     API NestJS (auth, businesses, products, purchases, sales, reports)
frontend/    App Next.js — UI de registro rápido y reportes
docs/        Specs y planes de implementación (superpowers/specs, superpowers/plans)
```

Las decisiones de negocio ya cerradas (modelo de datos, costo promedio
ponderado, control de stock, zona horaria de reportes, etc.) y el diseño de
implementación del backend están en
`docs/superpowers/specs/2026-09-21-sap-hermana-backend-design.md`, y el plan
tarea-por-tarea en `docs/superpowers/plans/2026-09-21-sap-hermana-backend.md`.

## Estado

Backend (auth, los 5 módulos de dominio, reportes con agregación consciente
de la zona horaria de Lima, Swagger, CI/CD) y frontend están implementados y
desplegados: backend en Fly.io, frontend en Vercel (ver `DEPLOY.md`).

## Levantar todo con Docker (automático)

La DB siempre es Neon — un solo modo, sin flags.

Copiar `.env.example` a `.env` en la raíz y completar `DATABASE_URL` con el
connection string real del *pooled connection* de Neon (host con `-pooler`,
tomado directo del dashboard de Neon). Nunca commitear ese `.env` — ya está
en `.gitignore`.

```bash
docker compose up -d --build
```

Corre migraciones + seed del usuario único (solo crea el usuario si no
existe — no pisa su password en restarts posteriores) contra Neon, y
levanta frontend (`:3000`) y backend (`:3001`).

```bash
docker compose down          # detiene todo
docker compose logs -f       # logs en vivo de los 2 servicios
```

`NODE_ENV=production` dentro de los contenedores implica que Swagger
(`/api/docs`) queda deshabilitado por diseño; para probar la API interactiva
usar `npm run start:dev` local (ver abajo) en vez de Docker.

## Desarrollo local (sin Docker)

```bash
# Backend
cd backend
npm install
npm run migration:run
npm run start:dev      # http://localhost:3000, docs en /api/docs

# Frontend
cd frontend
pnpm install
pnpm dev                # http://localhost:3000 (o el puerto libre siguiente)
```

Variables de entorno del backend (modo local, contra Neon): ver
`backend/.env.example`.
