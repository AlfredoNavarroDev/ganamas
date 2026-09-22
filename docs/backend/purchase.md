# purchase

Registro de compras de inventario. Cada compra recalcula `stock` y
`avg_cost` (costo promedio ponderado) del producto afectado.

**Archivos:** `purchase.controller.ts`, `purchase.service.ts`,
`purchase.module.ts`, `dto/create-purchase.dto.ts`,
`dto/list-purchases-query.dto.ts`.

## Endpoints

Todos requieren `Authorization: Bearer <token>`.

| Método | Ruta | Query/Body | Respuesta |
|---|---|---|---|
| POST | `/purchases` | `CreatePurchaseDto` | `Purchase` creada; recalcula `stock`/`avgCost` del producto |
| GET | `/purchases` | `ListPurchasesQueryDto` (`businessId` requerido, `productId`/`from`/`to` opcionales, paginado) | `{ data, total, page, limit }` |

## Comportamiento (`create`)

Corre dentro de una transacción con lock pesimista sobre el `Product`:

1. Busca el producto por `id` + `business.id` (evita que un `productId` de
   otro negocio se cuele) con `lock: { mode: 'pessimistic_write' }`.
2. Si no existe → `404 Not Found`.
3. Recalcula, todo vía `decimal.js`:
   ```
   newStock   = product.stock + purchase.quantity
   newAvgCost = newStock == 0
     ? product.avgCost                                            // evita división por cero
     : (product.stock * product.avgCost + purchase.quantity * purchase.unitCost) / newStock
   ```
4. Guarda el producto actualizado, luego crea la fila de `Purchase`.
5. `Purchase.totalCost` es columna generada (`quantity * unit_cost`) — nunca
   se asigna desde el código.

Este promedio se calcula sobre el historial de compras completo; **no**
descuenta lo ya vendido (no es inventario contable estricto tipo FIFO) — es
la aproximación elegida para el tamaño de este negocio.

## `findAll`

`QueryBuilder` con join a `product`, filtros opcionales `productId`/`from`/
`to` sobre `purchasedAt`, orden `purchasedAt DESC`, paginado
(`page`/`limit`, default `1`/`50`, heredado de `PaginationQueryDto`).

## Validación (`CreatePurchaseDto`)

| Campo | Reglas |
|---|---|
| `businessId` | `@IsUUID()` |
| `productId` | `@IsUUID()` |
| `quantity` | `@IsNumberString()` — **no valida positividad**; la DB sí exige `CHECK (quantity > 0)`, así que `0` o negativo responde `500`, no `400` |
| `unitCost` | `@IsNumberString()` — mismo caso que `quantity` |
| `purchasedAt` | opcional, `@IsDateString()`, default `now()` |

## Tests

`purchase.service.spec.ts` — recalcula `avg_cost` correctamente sobre stock
existente, 404 si el producto no existe/no pertenece al negocio.
`test/purchase.e2e-spec.ts` — compra real vía HTTP, verifica stock/avgCost
resultantes.
