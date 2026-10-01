# expense

Registro de gastos del negocio (insumos, alquiler, etc.). A diferencia de
`purchase`, no toca `Product` — es un ledger plano, sin recálculo de stock
ni costo. **No resta de `profit`/`revenue` en `reports`**: es un registro
informativo, separado a propósito de las métricas de ganancia (ver
`docs/superpowers/specs/2026-09-29-gastos-meta-costo-compra-design.md` §2).

**Archivos:** `expense.controller.ts`, `expense.service.ts`,
`expense.module.ts`, `dto/create-expense.dto.ts`,
`dto/list-expenses-query.dto.ts`, `entities/expense.entity.ts`.

## Endpoints

Todos requieren `Authorization: Bearer <token>`.

| Método | Ruta | Query/Body | Respuesta |
|---|---|---|---|
| POST | `/expenses` | `CreateExpenseDto` | `Expense` creado |
| GET | `/expenses` | `ListExpensesQueryDto` (`businessId` requerido, `from`/`to` opcionales, paginado) | `{ data, total, page, limit }` |

Solo `POST`/`GET` — como `purchase`, es un registro inmutable: no hay
`PATCH`/`DELETE`.

## Comportamiento (`create`)

Sin transacción ni lock — no hay estado compartido que recalcular (a
diferencia de `purchase`/`sale`, que sí tocan `Product.stock`/`avgCost`).

1. `amount` se normaliza con `decimal.js` (`new Decimal(dto.amount).toFixed(2)`)
   antes de guardar — evita que `"25"` se guarde/devuelva distinto de
   `"25.00"` según se recargue o no la página (mismo patrón que
   `sale.service.ts`).
2. `expensedAt` es opcional: si no se manda, la columna usa su propio
   default de DB (`now()`); el código nunca asigna `new Date()` a mano
   salvo que el DTO lo traiga explícito.
3. `business` se asigna como referencia liviana (`{ id: dto.businessId }`),
   sin verificar que el negocio exista o pertenezca al usuario autenticado
   — mismo gap de tenancy que `purchase`/`sale` (ver README).

## `findAll`

`QueryBuilder` sin joins, filtros opcionales `from`/`to` sobre
`expensedAt`, orden `expensedAt DESC`, paginado (`page`/`limit`, default
`1`/`50`, heredado de `PaginationQueryDto`). El índice compuesto
`(business_id, expensed_at)` cubre exactamente este patrón de query
(`WHERE business_id = … ORDER BY expensed_at DESC LIMIT … OFFSET …`).

## Validación (`CreateExpenseDto`)

| Campo | Reglas |
|---|---|
| `businessId` | `@IsUUID()` |
| `amount` | `@IsNumberString()` — no valida positividad en el DTO; la DB exige `CHECK (amount > 0)`, mapeado a `400` por el filtro global (ver `docs/backend/README.md`) |
| `description` | `@IsString() @Length(1, 255)` |
| `expensedAt` | opcional, `@IsDateString()`, default `now()` de la DB |

## Tests

`expense.service.spec.ts` — crea un gasto scoped al negocio, pasa
`expensedAt` explícito como `Date`, filtra por `businessId`/`from`/`to` con
paginación, default `page=1 limit=50` cuando no se especifica. **No** hay
un caso que verifique la normalización de `amount` con un input sin dos
decimales (ej. `"25"` → `"25.00"`) — todos los fixtures ya usan `"25.00"`.

`test/expense.e2e-spec.ts` — crea un gasto real vía HTTP y lo lista
paginado, verificando `total` y que aparezca en `data`.
