# Backend — documentación por módulo

Referencia técnica del código en `/backend/src`, módulo por módulo: qué hace,
qué endpoints expone, qué reglas de negocio aplica y qué validaciones tiene
cada DTO. Para el porqué de las decisiones de diseño (modelo de datos,
zona horaria, costo promedio ponderado, etc.) ver
`docs/superpowers/specs/2026-09-21-sap-hermana-backend-design.md`.

## Módulos

| Módulo | Qué hace |
|---|---|
| [auth](./auth.md) | Login único usuario, emisión/validación de JWT, guard global |
| [business](./business.md) | CRUD de negocios (owner-scoped, soft-delete) |
| [product](./product.md) | CRUD de productos: precio, stock, `avg_cost`, soft-delete |
| [purchase](./purchase.md) | Registro de compras: recalcula stock y costo promedio |
| [sale](./sale.md) | Registro de ventas: control de stock, snapshot de precio/costo |
| [expense](./expense.md) | Registro de gastos: ledger plano, no afecta stock ni `profit` |
| [reports](./reports.md) | Corte semanal y KPIs, agregación consciente de zona horaria Lima |
| [closing](./closing.md) | Cierre de día: congela un snapshot de `reports.summary()` |

## Convenciones transversales (no repetidas en cada módulo)

- **Auth:** `JwtAuthGuard` es un `APP_GUARD` global (`auth/auth.module.ts`).
  Todo endpoint requiere `Authorization: Bearer <token>` excepto
  `POST /auth/login` (`@Public()`). Un solo usuario por instancia, sin
  registro público.
- **Dinero/cantidades:** toda columna `numeric` se tipa `string` en las
  entidades y se opera con `decimal.js` (`new Decimal(x)`), nunca `number`
  nativo — evita imprecisión de floats.
- **Columnas generadas** (`Purchase.totalCost`; `Sale.total/profit/discount`):
  `GENERATED ALWAYS AS ... STORED` en Postgres, mapeadas `insert: false,
  update: false` en TypeORM. El código de aplicación nunca las asigna.
- **Concurrencia:** toda escritura que toca `Product.stock`/`avg_cost`
  (`PurchaseService.create`, `SaleService.create`, `SaleService.remove`)
  corre dentro de `dataSource.transaction()` con
  `lock: { mode: 'pessimistic_write' }` sobre la fila del producto.
- **Paginación:** `GET /purchases`, `GET /sales` y `GET /expenses` heredan
  `PaginationQueryDto` (`common/dto/pagination-query.dto.ts`) — `page`/`limit`
  opcionales, default `page=1 limit=50`. `businesses` y `products` no paginan.
- **Validación global:** `ValidationPipe({ whitelist: true,
  forbidNonWhitelisted: true, transform: true })` en `main.ts` — cualquier
  campo no declarado en el DTO es rechazado, no ignorado.
- **Filtro de excepciones global:** `QueryFailedExceptionFilter`
  (`common/filters/query-failed-exception.filter.ts`, registrado en
  `main.ts` vía `app.useGlobalFilters`) intercepta `QueryFailedError` de
  TypeORM y mapea el código de error de Postgres a un status HTTP en vez de
  dejar pasar un `500` genérico: `23505` (unique violation) → `409`,
  `23514`/`23502`/`23503` (check/not-null/foreign-key violation) → `400`,
  cualquier otro código → `400` genérico. El mensaje siempre es genérico en
  español ("El registro ya existe.", "Los datos enviados no son
  válidos.") — no expone detalle de la constraint ni de la query. Esto
  **no reemplaza** las excepciones explícitas que ya lanza un service (ej.
  `ClosingService.closeToday` sigue tirando su propio `ConflictException`
  con mensaje específico antes de que la query falle) — el filtro sólo
  actúa quando ningún código de servicio interceptó el error primero.
  No está registrado en los tests e2e (cada `*.e2e-spec.ts` arma su propia
  `INestApplication` sin pasar por `main.ts`), así que sólo corre en la app
  real.
- **Swagger:** `/api/docs`, con `@ApiBearerAuth()` en todo controller
  protegido; deshabilitado cuando `NODE_ENV=production` (`src/swagger.ts`).

## Gaps conocidos (no bloqueantes, ver PR #1 / ledger de implementación)

- No hay chequeo de ownership/tenancy sobre `businessId` en
  Product/Purchase/Sale/Expense/Reports — no explotable hoy porque la app
  es de un solo usuario sembrado sin registro público, pero es una brecha
  real si alguna vez hay más de un usuario.
- Sin rate-limiting en `POST /auth/login`, sin CORS configurado en `main.ts`.
