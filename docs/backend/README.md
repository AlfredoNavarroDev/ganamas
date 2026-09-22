# Backend — documentación por módulo

Referencia técnica del código en `/backend/src`, módulo por módulo: qué hace,
qué endpoints expone, qué reglas de negocio aplica y qué validaciones tiene
cada DTO. Para el porqué de las decisiones de diseño (modelo de datos,
zona horaria, costo promedio ponderado, etc.) ver
`sap-hermana-backend/CLAUDE.md`, que es la fuente de verdad del dominio.

Esta carpeta se regenera con la skill `document-backend` — no editar a mano
si un módulo cambia; correr la skill de nuevo.

## Módulos

| Módulo | Qué hace |
|---|---|
| [auth](./auth.md) | Login único usuario, emisión/validación de JWT, guard global |
| [business](./business.md) | CRUD de negocios (owner-scoped, soft-delete) |
| [product](./product.md) | CRUD de productos: precio, stock, `avg_cost`, soft-delete |
| [purchase](./purchase.md) | Registro de compras: recalcula stock y costo promedio |
| [sale](./sale.md) | Registro de ventas: control de stock, snapshot de precio/costo |
| [reports](./reports.md) | Corte semanal y KPIs, agregación consciente de zona horaria Lima |

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
- **Paginación:** `GET /purchases` y `GET /sales` heredan
  `PaginationQueryDto` (`common/dto/pagination-query.dto.ts`) — `page`/`limit`
  opcionales, default `page=1 limit=50`. `businesses` y `products` no paginan.
- **Validación global:** `ValidationPipe({ whitelist: true,
  forbidNonWhitelisted: true, transform: true })` en `main.ts` — cualquier
  campo no declarado en el DTO es rechazado, no ignorado.
- **Swagger:** `/api/docs`, con `@ApiBearerAuth()` en todo controller
  protegido; deshabilitado cuando `NODE_ENV=production` (`src/swagger.ts`).

## Gaps conocidos (no bloqueantes, ver PR #1 / ledger de implementación)

- No hay filtro de excepciones global: una violación de constraint de la DB
  (`CHECK`, `UNIQUE`, FK) devuelve `500` en vez de un `4xx` (ej. cantidad
  negativa, nombre de negocio duplicado, `businessId` inexistente).
- No hay chequeo de ownership/tenancy sobre `businessId` en
  Product/Purchase/Sale/Reports — no explotable hoy porque la app es de un
  solo usuario sembrado sin registro público, pero es una brecha real si
  alguna vez hay más de un usuario.
- Sin rate-limiting en `POST /auth/login`, sin CORS configurado en `main.ts`.
