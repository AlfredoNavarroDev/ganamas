---
name: document
description: Generates or refreshes reference docs under docs/<area>/ (docs/backend/, docs/frontend/, docs/database/, docs/deployment/) by reading the actual source — never from memory, never from the plan/spec docs in docs/superpowers/ (those describe intent; this skill describes what the code does right now, and the two can drift). Use this whenever the user asks to document the backend, frontend, database, or deployment setup, write/update module or page docs, explain in writing what a piece of the system does, or after changing backend/src, frontend/app or frontend/lib, migrations/entities, or deploy config (Dockerfile, fly.toml, docker-compose.yml, .github/workflows) and they want the docs kept current. Also use it proactively if you notice a docs/<area>/ folder is stale relative to its source — a module/page/table exists in code with no matching .md, or a documented endpoint/route no longer matches the code — don't wait to be asked.
---

# document

Produces the per-unit reference docs under `docs/<area>/` by reading the
real source for that area — never from memory, never from
`docs/superpowers/specs|plans` (those capture intent *before* the work; this
skill captures what's actually true *after*). Re-run the relevant area any
time its source changes instead of hand-editing `docs/<area>/*.md` — hand
edits get silently overwritten the next time someone reruns this without
realizing they're there, so don't leave any.

## Why this exists

Writing these docs well means reading the real implementation end to end —
every route/page, every validation rule, every non-obvious behavior (lock
ordering, generated columns, timezone handling, client-side previews that
aren't the source of truth) — and stating what's actually true, including
where two parts of the system have drifted apart. Doing that by hand each
time is exactly the kind of repetitive, easy-to-shortcut work that produces
stale or shallow docs. This skill is the checklist that keeps the depth
consistent across every area of the project, not just the backend.

## Areas

Each area lives at `docs/<area>/`, with a `README.md` index plus one `.md`
per documentable "unit". What counts as a unit, and where to read it from,
differs by area:

| Area | Source root | Unit | Unit test for "documentable" |
|---|---|---|---|
| `backend` | `backend/src/` | one NestJS module | directory containing a `*.module.ts` (skip `entities/`, `migrations/`, `scripts/`, `common/` — cross-cutting, goes in the README instead) |
| `frontend` | `frontend/app/`, `frontend/lib/` | one route/page | directory containing a `page.tsx` under `app/` |
| `database` | `backend/src/migrations/`, `backend/src/entities/` | one table/entity | one `*.entity.ts` with its migration(s) |
| `deployment` | repo root, `backend/Dockerfile`, `backend/fly.toml`, `frontend/Dockerfile`, `docker-compose.yml`, `.github/workflows/`, `DEPLOY.md` | no per-unit split — single `README.md` covering every deploy path | — |

If the user asks to document something that doesn't fit an existing area
(e.g. a new "mobile" or "infra" concern), create `docs/<area>/` following
the same shape rather than forcing it into one of the four above.

**Before writing anything**, check `.gitignore` for a `docs/*` /
`!docs/<area>` pair. If the area is new, add the `!docs/<area>` and
`!docs/<area>/**` exceptions — otherwise the docs you write won't be
tracked and the next `git status` will look like nothing happened.

## Process

1. **Scope the request.** "Documenta el backend" → area `backend`. "Cómo se
   despliega esto" or "documenta el deploy" → area `deployment`. If the
   user just says "documenta el proyecto" with no area, do all of them,
   one at a time, in the order in the table above.

2. **List units for the area** (see table). Diff against the `.md` files
   already in `docs/<area>/` — a unit with no matching doc, or a doc with
   no matching unit (renamed/removed) — both are signals, not just
   "regenerate everything from scratch every time." A file that would come
   out byte-identical doesn't need to be rewritten.

3. **Per unit, read the real source, not its neighbors' assumptions about
   it:**
   - **backend module:** controller (every route, method, guard/auth
     decorator or lack of one — check for a global `APP_GUARD` before
     concluding a route is open), service (real logic: validations,
     transactions/locks and their order, every throw and its status,
     what's returned), every DTO's actual decorators (a field that *reads*
     like it validates a positive number often doesn't — say so if a DB
     constraint is stricter), entity columns the service touches
     (especially `generatedType: 'STORED'` / `insert:false,update:false`),
     the module's `*.spec.ts` and matching `test/*.e2e-spec.ts`.
   - **frontend page:** the `page.tsx` itself — what it fetches and when
     (which `useEffect`, what triggers a refetch), every `localStorage`
     read/write (`lib/auth.ts`, `lib/business.ts`), what it computes
     client-side vs. what it treats as server truth (flag any client-side
     calculation that previews a value the backend will recompute — that
     gap is exactly the kind of thing worth documenting explicitly), error
     handling (inline `Alert` vs. toast vs. silently swallowed), loading
     state shape, and the matching `page.test.tsx`. Cross-check every
     endpoint the page calls against the matching `docs/backend/*.md` — if
     the backend doc doesn't mention that route yet, say so in the page's
     doc instead of inventing backend behavior from the frontend call site.
   - **database table:** the entity file (every column, type, default,
     generated columns and their exact expression, indexes, unique
     constraints, FK relations and `onDelete` behavior) cross-checked
     against its migration(s) — the migration is the ground truth for
     what's actually in Postgres; the entity is what TypeScript believes.
     Note any mismatch between them explicitly rather than picking one
     silently.
   - **deployment:** read every config file in the source-root list above,
     not just `DEPLOY.md` — `DEPLOY.md` describes the intended procedure,
     the actual `fly.toml`/`Dockerfile`/workflow YAML is what runs. Note
     env vars each service requires (cross-check against `.env.example`
     files), what CI does vs. skips (e.g. a lint step removed from a
     workflow), and which service deploys where.

4. **Write `docs/<area>/<unit>.md`** using that area's template (below).
   Match the register of whatever docs already exist in `docs/` — terse,
   technical, Spanish, no marketing language — rather than introducing a
   new voice per area or per unit.

5. **Update `docs/<area>/README.md`**: the unit table and the "Gaps
   conocidos" section if this pass revealed a new one or resolved an old
   one. Leave "Convenciones transversales" (or equivalent shared section)
   untouched unless the cross-cutting behavior itself changed.

6. **Report back concisely**: which files were created, which were
   updated and why, which units had no changes because the docs were
   already accurate, and any cross-area inconsistency found (a frontend
   page calling a backend route with no matching doc, a migration that
   doesn't match its entity) — surface these even if fixing them is out of
   scope for the current request.

## Templates

### `backend/<module>.md`

```markdown
# <module-name>

<What this module is for in domain terms, not "handles CRUD for X".>

**Archivos:** <controller>, <service>, <module>, every dto file.

## Endpoints
<Table: Método | Ruta | Auth | Query/Body | Respuesta — controller order.>

## Comportamiento
<Real logic in execution order for the interesting endpoints: transactions
and lock order explicitly, decimal.js vs. Postgres-generated columns,
every explicit throw and its HTTP status, anything a reader would guess
wrong from the method name alone.>

## Validación (`<DtoName>`)
<Table: Campo | Reglas, read from decorators. State explicitly where a DB
constraint is stricter than the DTO.>

## Tests
<One sentence per spec file: what it actually exercises, edge cases named.>
```

### `frontend/<page>.md`

```markdown
# <page-name>

<What the page shows and for whom, in one or two sentences.>

**Archivos:** <page.tsx path>, <page.test.tsx path>.

## Comportamiento
<Guards (auth/business), what it fetches and when, every localStorage
read/write, client-side calculations that are previews vs. server truth,
error/loading states, cross-checked against the backend route's doc — flag
any mismatch or undocumented backend route instead of guessing.>

## Validación
<Client-side validation only, if any — most real validation lives in the
backend DTO; say so rather than padding this section.>

## Tests
<One sentence per meaningful test case, edge cases named.>
```

### `database/<table>.md`

```markdown
# <table-name>

<What this table represents in domain terms.>

**Archivos:** <entity file>, <migration file(s)>.

## Columnas
<Table: Columna | Tipo | Constraints/default | Generada (sí/no + expresión
si aplica).>

## Índices y relaciones
<Every index, unique constraint, FK with onDelete behavior.>

## Notas
<Anything the entity and migration disagree on; anything non-obvious about
why a column is generated vs. computed in application code.>
```

### `deployment/README.md`

```markdown
# Deployment

<One paragraph: what deploys where (e.g. backend on Fly.io, frontend on
Vercel, DB on Neon) and what triggers it (push to main via CI, manual
`fly deploy`, etc).>

## Servicios

<Per service: dónde corre, cómo se construye (Dockerfile / build command),
variables de entorno requeridas (cross-check against .env.example), health
check si aplica.>

## CI/CD

<Per workflow file: qué corre, en qué evento, qué pasos están
deliberadamente ausentes (ej. lint quitado) y por qué si se sabe.>

## Gaps conocidos
<Anything DEPLOY.md promises that the actual config doesn't do, or vice versa.>
```

Omit a section only if it's genuinely empty for that unit — no "N/A"
padding, just leave the heading out.

## Things this skill has caught before

- A DTO field validated with `@IsNumberString()` reads like "positive
  number" but only checks the string is numeric — the real floor is a
  Postgres `CHECK`, so an invalid request fails `500`, not a clean `400`.
  Worth stating in both Comportamiento and Validación.
- A frontend page computing a total client-side (e.g. subtotal minus a
  discount) to show the user before submitting is a *preview*, not the
  value that persists — the backend recomputes it and can disagree
  silently. State this explicitly instead of implying the two calculations
  are the same thing.
- A frontend page calling an endpoint (`/reports/summary`) that the
  existing backend docs never mention (they document
  `/reports/weekly-summary` and `/reports/kpis` instead) is a real drift
  signal — say so in the frontend doc rather than describing the missing
  endpoint as if it were documented elsewhere.
- A controller with no `@UseGuards(...)` isn't necessarily unprotected —
  check for a global `APP_GUARD` registration before concluding a route is
  public. Getting this wrong in either direction is the single most
  misleading thing a doc could say.
- `docs/*` being gitignored except for specific area exceptions means a
  brand-new `docs/<area>/` silently never gets committed unless the
  `.gitignore` exception is added in the same pass.
