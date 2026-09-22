# sale

Registro de ventas. Una venta = una fila = un producto (sin carrito ni
líneas múltiples) — decisión explícita para mantener el registro rápido.
Controla stock, congela precio/costo al momento de vender, y revierte stock
si la venta se borra.

**Archivos:** `sale.controller.ts`, `sale.service.ts`, `sale.module.ts`,
`dto/create-sale.dto.ts`, `dto/list-sales-query.dto.ts`.

## Endpoints

Todos requieren `Authorization: Bearer <token>`.

| Método | Ruta | Query/Body | Respuesta |
|---|---|---|---|
| POST | `/sales` | `CreateSaleDto` | `Sale` creada; descuenta stock del producto |
| GET | `/sales` | `ListSalesQueryDto` (`businessId` requerido, `productId`/`from`/`to` opcionales, paginado) | `{ data, total, page, limit }` |
| DELETE | `/sales/:id` | — | hard delete + revierte stock |

## Comportamiento (`create`)

Transacción con lock pesimista sobre el `Product`:

1. Busca el producto por `id` + `business.id`, con
   `lock: { mode: 'pessimistic_write' }`. No existe → `404`.
2. Valida `product.stock >= quantity` (vía `decimal.js`); si no alcanza →
   `400 Bad Request` — se prioriza no vender lo que no se tiene, sobre
   permitir venta con warning.
3. `unitPrice`: si el DTO no lo manda, usa `product.price` tal cual. Si lo
   manda con un valor menor, es regateo — se guarda igual, y `listPrice`
   conserva el precio de catálogo para poder reportar cuánto se descontó.
   No hay `CHECK` en DB que impida `unitPrice > listPrice` (el precio puede
   subir por temporada/escasez, no se bloquea a nivel de esquema).
4. `unitCost` = snapshot de `product.avgCost` **al momento de vender** —
   nunca se recalcula después. Si el costo promedio cambia por una compra
   nueva, las ganancias de ventas pasadas no se mueven solas.
5. Descuenta `product.stock -= quantity`, guarda el producto, crea la venta.
6. `Sale.total`, `Sale.profit`, `Sale.discount` son columnas generadas en la
   DB (`quantity*unitPrice`, `total - quantity*unitCost`,
   `(listPrice-unitPrice)*quantity`) — nunca se asignan desde el código.

## Comportamiento (`remove`)

Hard delete — corrige errores de tipeo sin dejar basura, no es un objeto de
catálogo (a diferencia de `Product`/`Business`, que son soft-delete):

1. Busca la venta por `id` con su `product` relacionado. No existe → `404`.
2. Vuelve a bloquear el `Product` con `pessimistic_write` — **no confía** en
   la relación ya cargada sin lock — y le suma de vuelta `sale.quantity` al
   stock.
3. Elimina la fila de `Sale`.

Sin este orden el inventario queda descuadrado. Nota: el `Sale` en sí se lee
sin lock antes de bloquear el `Product` — dos borrados concurrentes de la
misma venta podrían ambos leerla y ambos acreditar stock (el segundo
`remove` borraría 0 filas silenciosamente); de bajo riesgo en una app de un
solo usuario.

## `findAll`

Igual patrón que `purchase`: `QueryBuilder` + join a `product`, filtros
opcionales `productId`/`from`/`to` sobre `soldAt`, orden `soldAt DESC`,
paginado.

## Validación (`CreateSaleDto`)

| Campo | Reglas |
|---|---|
| `businessId` | `@IsUUID()` |
| `productId` | `@IsUUID()` |
| `quantity` | `@IsNumberString()` — no valida positividad; la DB exige `CHECK (quantity > 0)` |
| `unitPrice` | opcional, `@IsNumberString()` — omitir usa el precio de catálogo |
| `paymentMethod` | opcional, `@IsIn(['efectivo', 'yape', 'plin'])`, default `'efectivo'` |
| `soldAt` | opcional, `@IsDateString()`, default `now()` |

## Tests

`sale.service.spec.ts` — descuento de stock, rechazo por stock insuficiente,
reversión de stock al borrar, snapshot de `unitCost`/`listPrice`.
`test/sale.e2e-spec.ts` — venta real vía HTTP, incluye el flujo
create→delete→verificar stock revertido.
