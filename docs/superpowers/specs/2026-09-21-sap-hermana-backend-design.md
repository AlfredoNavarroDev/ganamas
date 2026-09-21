# SAP hermana — Backend implementation design

Date: 2026-09-21

This spec covers the **implementation architecture** for the backend: how the
already-decided domain model and business rules (see
`sap-hermana-backend/CLAUDE.md`, the closed spec) get built into a real
NestJS app. It does not repeat domain/business-rule decisions already closed
there — it references them.

## Skill stacks

- Backend (`/backend`, NestJS): implementation follows the `nestjs-stack`
  skill (loads `nestjs-best-practices` + `nestjs-pro` together) — module
  structure, entity/DTO conventions, guards, migrations, testing, hardening
  all defer to that skill's patterns over ad-hoc choices.
- Frontend (`/frontend`, Next.js): implementation follows the `nextjs-stack`
  skill (loads the Next.js/UI/UX/design-taste/Vercel skill set together) —
  out of scope for this spec (backend-only), noted here so the frontend
  brainstorm/plan picks it up.

## Scope and target directory

`sap-hermana-backend/` is a delivered package (TypeORM `data-source.ts`,
`src/entities`, `src/dto`, `src/migrations`, `src/scripts/seed-user.ts`) —
**not** the final project. `/backend` (sibling directory, repo root
`ganamas/`) is the real target: an already-scaffolded NestJS v11 project
(`nest-cli.json`, npm, jest configured) with only default boilerplate
(`app.controller.ts`, `app.service.ts`, their specs, `app.module.ts`).

Plan:
- Move `sap-hermana-backend/data-source.ts` → `backend/data-source.ts`.
- Move `sap-hermana-backend/src/{entities,dto,migrations,scripts}` →
  `backend/src/{entities,dto,migrations,scripts}`.
- Delete default Nest boilerplate (`app.controller.ts`,
  `app.controller.spec.ts`, `app.service.ts`) — unused once real modules
  exist.
- Install in `/backend`: `@nestjs/typeorm typeorm pg`, `@nestjs/config`,
  `@nestjs/jwt @nestjs/passport passport passport-jwt`,
  `class-validator class-transformer`, `bcrypt`, `@nestjs/swagger`.
- `sap-hermana-backend/` is emptied by the move; left in place (not deleted)
  until the merge is verified working, then removed in a follow-up cleanup
  step — not part of this plan's scope.

## Module architecture

One module per entity, plus a cross-cutting reports module and a shared
database module:

- `DatabaseModule` — TypeORM connection via `@nestjs/config`
  (`ConfigModule.forRoot` + `TypeOrmModule.forRootAsync`), reads
  `DATABASE_URL`.
- `AuthModule` — JWT strategy, `POST /auth/login`, `JwtAuthGuard`.
- `BusinessModule` — CRUD, soft-delete via `active`.
- `ProductModule` — CRUD, soft-delete via `active`.
- `PurchaseModule` — create purchase, recalculates `avg_cost`/`stock` with
  pessimistic lock (rule already closed in `sap-hermana-backend/CLAUDE.md`).
- `SaleModule` — create/list/delete sale, stock validation + reversion on
  delete, pessimistic lock (rule already closed).
- `ReportsModule` — no own entity; injects `Sale`/`Product` repositories via
  query builder for `weekly-summary` and `kpis`.

## Build order (implementation phases)

1. Scaffolding: move files into `/backend`, install deps, get migrations +
   seed running against a real Postgres instance.
2. Auth: JWT strategy, global `JwtAuthGuard` via `APP_GUARD` +
   `@Public()` decorator on `/auth/login` only.
3. Business: CRUD, soft-delete.
4. Product: CRUD, soft-delete.
5. Purchase: avg_cost recalculation, pessimistic lock, transaction.
6. Sale: stock control, pessimistic lock, transaction, delete-reverts-stock.
7. Reports: weekly-summary, kpis.
8. Hardening: global `ValidationPipe`, Swagger setup, README, full e2e pass.

Each phase gets its own unit tests before moving to the next phase (TDD per
module — see `superpowers:test-driven-development`).

## API conventions

- Global `ValidationPipe`: `whitelist: true, forbidNonWhitelisted: true,
  transform: true`.
- Error format: Nest's default (`{statusCode, message, error}`) — no custom
  exception filter.
- Pagination: `GET /sales` and `GET /purchases` accept `?page=&limit=`
  (default `limit=50`), respond `{data, total, page, limit}`. `GET
  /businesses` and `GET /products` stay unpaginated (small catalog volume).
- `JwtAuthGuard` registered globally via `APP_GUARD`; `@Public()` decorator
  exempts only `POST /auth/login`.

## Reports — calculation detail

- `GET /reports/weekly-summary`: groups by
  `sold_at AT TIME ZONE 'America/Lima'` per day (per the timezone rule
  already closed in `sap-hermana-backend/CLAUDE.md`), sums revenue / cost /
  profit / discount, plus a breakdown by `payment_method`.
- `GET /reports/kpis`:
  - Best day / best hour ranked by **profit** (not revenue).
  - Top products ranked by `SUM(profit) GROUP BY product`.
  - Low-stock alert: fixed global threshold via env var
    `LOW_STOCK_THRESHOLD` (default `5`), applied the same way regardless of
    `unit` (`'unidad'` or `'kg'`). No per-product threshold column — that
    would require a schema change outside the already-closed data model.

## Auth

Single JWT, no refresh token (single-user app, per
`sap-hermana-backend/CLAUDE.md`'s explicit out-of-scope list). Long-lived
`JWT_EXPIRES_IN` (suggested `30d` in `.env.example`). Login validates
`bcrypt.compare` against `password_hash`.

## API documentation — Swagger

- `@nestjs/swagger`, `DocumentBuilder`, served at `/api/docs`.
- Bearer auth scheme registered (`addBearerAuth`) so guarded routes show the
  authorize button in the Swagger UI.
- Tag per module (`Auth`, `Businesses`, `Products`, `Purchases`, `Sales`,
  `Reports`).
- DTOs decorated with `@ApiProperty` (existing DTOs in
  `sap-hermana-backend/src/dto` get these added, not replaced).
- Not exposed in production (`NODE_ENV === 'production'` skips
  `SwaggerModule.setup`), since this is a small single-user app with no need
  to expose API docs publicly.

## README

New `backend/README.md` replacing the current default Nest CLI README.
Contents: project description, stack, prerequisites, env vars table (from
`sap-hermana-backend/CLAUDE.md`'s env var list), setup steps (install →
migration:run → seed-user → seed initial businesses), run commands (dev/
prod/test/test:e2e), link to `/api/docs` for live API reference, and a
pointer to `sap-hermana-backend/CLAUDE.md` for domain/business-rule
decisions.

## Testing

- Unit tests: `PurchaseService` (avg_cost math), `SaleService` (stock
  lock/revert), guards (`JwtAuthGuard`, `@Public()`).
- Full e2e: one `test/*.e2e-spec.ts` per module, against a real test
  Postgres instance (no mocking — TypeORM transactions and pessimistic
  locks need real DB behavior to test meaningfully).

## Out of scope (unchanged from `sap-hermana-backend/CLAUDE.md`)

`stock_adjustment` (mermas/pérdidas) and fiado/crédito remain deferred, per
the already-closed decision. This spec does not revisit that.
