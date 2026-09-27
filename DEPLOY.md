# Deploy: backend en Fly.io, frontend en Vercel

## Backend (Fly.io)

Repo ya trae `backend/fly.toml`. App name placeholder `ganamas-backend` — cambialo si está tomado (nombre global único en Fly).

Setup (una sola vez, con [flyctl](https://fly.io/docs/flyctl/install/) instalado y logueado):

```
cd backend
fly launch --no-deploy   # detecta fly.toml existente, NO pisar el archivo si pregunta
fly secrets set DATABASE_URL="postgresql://...pooler..." \
  FRONTEND_URL="https://tu-app.vercel.app" \
  JWT_SECRET="$(openssl rand -hex 32)"
fly deploy
```

Variables ya fijas en `fly.toml` (`[env]`): `NODE_ENV`, `DATABASE_SSL`, `JWT_EXPIRES_IN`, `LOW_STOCK_THRESHOLD`. Las que van por `fly secrets set` (sensibles, no van en el archivo):
- `DATABASE_URL` — connection string de Neon (pooled, host con `-pooler`)
- `FRONTEND_URL` — URL de producción de Vercel. Acepta varias separadas por coma (soporte agregado en `main.ts`) si querés permitir un preview fijo también.
- `JWT_SECRET` — secreto random, no el `change-me` de dev

`min_machines_running = 1` + `auto_stop_machines = false` en `fly.toml` → sin cold sleep, siempre activo (entra en el free tier de Fly con 1 VM shared-cpu-1x/256mb). Región `gru` (São Paulo) — misma región que tu Neon DB (`sa-east-1`), latencia mínima entre backend y DB.

El entrypoint solo corre migraciones en cada deploy, después levanta el server — **ya no siembra usuario ni negocios demo automáticamente** (ver sección siguiente). Health check en `/health` cada 15s.

Al terminar el deploy, la URL pública queda en `https://ganamas-backend.fly.dev` (o el nombre que hayas puesto) — se necesita para el frontend.

### Usuario y negocio inicial (manual, una sola vez)

Ya no hay `SEED_USERNAME`/`SEED_PASSWORD` — el entrypoint no crea nada automático en producción. Crear el usuario y el negocio a mano, directo contra Neon (psql, o el SQL editor del dashboard de Neon):

1. Generar el hash del password (desde `backend/`, usa el `bcrypt` ya instalado):
   ```
   node -e "console.log(require('bcrypt').hashSync('TU_PASSWORD_REAL', 12))"
   ```
2. Crear el usuario (el id, created_at, updated_at tienen default en la DB, no hace falta pasarlos):
   ```sql
   INSERT INTO "user" (username, password_hash)
   VALUES ('admin', '$2b$12$PEGA_AQUI_EL_HASH_DEL_PASO_1');
   ```
3. Crear el negocio, con el `owner_id` del usuario recién creado:
   ```sql
   INSERT INTO business (owner_id, name)
   VALUES (
     (SELECT id FROM "user" WHERE username = 'admin'),
     'Nombre real del negocio'
   );
   ```
   Repetir el INSERT (con otro `name`) por cada negocio adicional (ej. uno para frutas, otro para ropa).

Productos, compras y ventas se cargan después desde la app misma (login con el usuario creado) — no hace falta SQL para eso.

No hay ningún script de seed en el repo (se eliminaron `seed:user`/`seed:demo`) — este es el único camino para crear el usuario inicial, en cualquier entorno.

## Frontend (Vercel)

Importar el repo en Vercel. Como es monorepo, en el paso de configuración del proyecto:
- **Root Directory**: `frontend`
- Framework: Next.js (auto-detectado)

Variables de entorno (Project Settings → Environment Variables):
- `NEXT_PUBLIC_API_URL` = URL pública del backend en Fly (ej. `https://ganamas-backend.fly.dev`)

Esta variable se embebe en build time — si cambia la URL del backend hay que hacer redeploy del frontend.

## Orden recomendado

1. Deploy backend en Fly.io primero, con `FRONTEND_URL` apuntando a la URL que Vercel te va a asignar (o el dominio custom si ya lo tenés).
2. Deploy frontend en Vercel con `NEXT_PUBLIC_API_URL` apuntando al backend de Fly.
3. Si la URL de Vercel cambia (dominio custom nuevo, etc.), actualizar `FRONTEND_URL` en Fly (`fly secrets set FRONTEND_URL=...`) y redeploy.

## Notas

- DB es Neon (Postgres serverless), ya en uso en dev — mismo `DATABASE_URL` de producción, no hace falta provisionar DB en Fly.
- CORS en el backend acepta `FRONTEND_URL` como lista separada por coma (`main.ts`).
- `fly.toml` vive dentro de `backend/` (no en la raíz) porque el build/deploy de Fly corre con esa carpeta como root del Dockerfile.
