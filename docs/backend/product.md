# product

CRUD de productos: catálogo, precio de lista, stock y costo promedio
ponderado (`avg_cost`) por producto.

**Archivos:** `product.controller.ts`, `product.service.ts`,
`product.module.ts`, `dto/create-product.dto.ts`, `dto/update-product.dto.ts`,
`dto/list-products-query.dto.ts`.

## Endpoints

Todos requieren `Authorization: Bearer <token>`.

| Método | Ruta | Query/Body | Respuesta |
|---|---|---|---|
| POST | `/products` | `CreateProductDto` | `Product` creado |
| GET | `/products` | `ListProductsQueryDto` (`businessId` requerido, `active` opcional, default `true`) | `Product[]` — incluye `stock` y `avgCost` |
| PATCH | `/products/:id` | `UpdateProductDto` | `Product` actualizado |
| DELETE | `/products/:id` | — | soft-delete (`active = false`) |

## Comportamiento

- `stock` y `avgCost` **no se setean al crear** — nacen en `0` (default de
  columna) y solo cambian vía el módulo `purchase` (compras) y `sale`
  (ventas). Este módulo nunca los toca directamente.
- `update` usa `Object.assign(product, dto)` sobre un `UpdateProductDto` que
  es `PartialType(OmitType(CreateProductDto, ['businessId']))` — `businessId`
  no es editable después de creado (un producto no cambia de negocio).
- `remove` es **soft-delete** (`active = false`), no hay `DELETE` real —
  preserva el historial de compras/ventas que referencian el producto.
  Nota: `UpdateProductDto` tampoco expone `active`, así que hoy no hay forma
  de reactivar un producto soft-deleted vía la API (solo SQL directo).
- `findAll` no valida ownership del `businessId` contra el usuario
  autenticado — ver gaps conocidos en el README de esta carpeta.

## Validación

`CreateProductDto`:

| Campo | Reglas |
|---|---|
| `businessId` | `@IsUUID()` |
| `name` | `@IsString() @Length(1, 150)` |
| `price` | `@IsNumberString()` — string decimal, no valida positividad |
| `unit` | `@IsIn(['unidad', 'kg'])` |
| `category` | opcional, `@IsString() @Length(1, 100)` |

`UpdateProductDto`: los mismos campos salvo `businessId`, todos opcionales.

`ListProductsQueryDto`: `businessId` (`@IsUUID()`, requerido),
`active` (opcional, `@IsBooleanString()`).

## Tests

`product.service.spec.ts` — create, findAll con filtro `active`, update, 404
en update/remove sobre id inexistente. `test/product.e2e-spec.ts` — CRUD real
vía HTTP.
