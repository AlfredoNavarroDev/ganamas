# Deployment

Backend en Fly.io, frontend en Vercel, DB en Neon (Postgres serverless). Backend
se despliega vía CI/CD (push a `main` → GitHub Actions → `flyctl deploy`);
frontend vía la integración Git nativa de Vercel (push a `main` → build y
deploy automático, sin paso propio en `.github/workflows/`).

## Servicios

### Backend (Fly.io)

- **Dónde corre**: Fly.io, app `ganamas-backend`, región `gru` (São Paulo) — misma región que la DB en Neon (`sa-east-1`), latencia mínima.
- **Build**: `backend/Dockerfile`, build multi-stage (compila con deps completas, runtime solo con `--omit=dev`; `bcrypt` requiere toolchain nativo — `python3 make g++` instalados y luego removidos en el runtime stage).
- **Arranque**: `docker-entrypoint.sh` corre `npm run migration:run` y recién después levanta `node dist/src/main` — nunca siembra usuario/negocio demo.
- **Health check**: `GET /health` cada 15s (`fly.toml`), `grace_period` 10s, `timeout` 5s.
- **Siempre activo**: `min_machines_running = 1` + `auto_stop_machines = 'off'` — sin cold sleep (free tier: 1 VM `shared-cpu-1x`/512mb).
- **Env vars fijas** (`backend/fly.toml` → `[env]`): `NODE_ENV=production`, `DATABASE_SSL=true`, `JWT_EXPIRES_IN=30d`, `LOW_STOCK_THRESHOLD=5`.
- **Secrets** (`fly secrets set`, no van en el repo — ver `backend/.env.example` para el resto de variables de dev):
  - `DATABASE_URL` — connection string de Neon, pooled (host con `-pooler`).
  - `FRONTEND_URL` — origen(es) permitido(s) por CORS (`backend/src/main.ts` hace `split(',')`, así que acepta varias URLs separadas por coma — útil para permitir también un preview fijo de Vercel).
  - `JWT_SECRET` — secreto random (`openssl rand -hex 32`), nunca el `change-me` de dev.

### Frontend (Vercel)

- **Dónde corre**: Vercel, proyecto importado desde el repo. Es monorepo — en la config del proyecto: **Root Directory** = `frontend`, framework Next.js auto-detectado. No hay `vercel.json` en el repo, esa config vive en el dashboard de Vercel.
- **Env var** (Project Settings → Environment Variables): `NEXT_PUBLIC_API_URL` = URL pública del backend en Fly (ej. `https://ganamas-backend.fly.dev`). Se embebe en build time — cambiar la URL del backend requiere redeploy del frontend.

### Base de datos (Neon)

- Postgres serverless, mismo `DATABASE_URL` en dev y producción (host `-pooler` para el pool en runtime) — no hace falta provisionar DB en Fly.

## CI/CD

### `.github/workflows/backend.yml` — Backend CI/CD

- Trigger: push o PR que tocan `backend/**` o el propio workflow.
- Job `test`: levanta Postgres 16 como servicio, corre `npm ci`, `lint`, `build`, `test` (unit), `migration:run` contra ese Postgres efímero, y `test:e2e`.
- Job `deploy`: solo si `test` pasa **y** es push a `main` (no corre en PRs) — `flyctl deploy --remote-only` con `FLY_API_TOKEN` desde secrets del repo.

### `.github/workflows/frontend.yml` — Frontend CI

- Trigger: push o PR que tocan `frontend/**` o el propio workflow.
- Único job: `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm build`. **No hay job de deploy** — el deploy real a producción lo dispara Vercel directo por su integración con GitHub (push a `main`), en paralelo a este workflow, no como parte de él.

## Setup inicial (una sola vez)

Con [flyctl](https://fly.io/docs/flyctl/install/) instalado y logueado:

```
cd backend
fly launch --no-deploy   # detecta fly.toml existente, NO pisar el archivo si pregunta
fly secrets set DATABASE_URL="postgresql://...pooler..." \
  FRONTEND_URL="https://tu-app.vercel.app" \
  JWT_SECRET="$(openssl rand -hex 32)"
fly deploy
```

Orden recomendado: backend primero (con `FRONTEND_URL` apuntando a la URL que Vercel va a asignar), después frontend en Vercel con `NEXT_PUBLIC_API_URL` apuntando al backend de Fly. Si la URL de Vercel cambia (dominio custom nuevo), actualizar `FRONTEND_URL` en Fly (`fly secrets set FRONTEND_URL=...`) y redeploy.

### Usuario y negocio inicial (manual)

No hay script de seed en el repo (se eliminaron `seed:user`/`seed:demo`) — este es el único camino, en cualquier entorno:

1. Generar el hash del password (desde `backend/`, usa el `bcrypt` ya instalado):
   ```
   node -e "console.log(require('bcrypt').hashSync('TU_PASSWORD_REAL', 12))"
   ```
2. Crear el usuario (`id`, `created_at`, `updated_at` tienen default en la DB):
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
   Repetir el INSERT (con otro `name`) por cada negocio adicional.

Productos, compras y ventas se cargan después desde la app misma (login con el usuario creado).

## Known gaps

- `fly.toml` vive dentro de `backend/` (no en la raíz) porque el build/deploy de Fly corre con esa carpeta como root del Dockerfile.
- El deploy de frontend no tiene ningún paso visible en este repo (ni workflow, ni `vercel.json`) — toda la config (Root Directory, env vars, dominios) vive solo en el dashboard de Vercel, fuera del control de versiones.
