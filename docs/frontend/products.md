# products

CRUD de productos del negocio activo, en `/dashboard/products`.

**Archivos:** `app/dashboard/products/page.tsx`,
`app/dashboard/products/page.test.tsx`.

## Comportamiento

Guard doble en el `useEffect` de montaje: sin token → `/login`; sin
`businessId` activo (`lib/business.ts`) → `/dashboard`. Recién después
carga `GET /products?businessId=<id>&active=true`.

**Crear:** formulario con `name`, `price`, `unit` (`unidad`|`kg`),
`category` opcional (`category || undefined` — un string vacío nunca se
manda como `""`, se omite del body). `POST /products`; la respuesta se
agrega al final del array local (`[...(prev ?? []), created]`), no se
vuelve a pedir la lista completa.

**Editar:** edición inline por fila (`editingId`), no modal. Al entrar en
modo edición se copian los valores actuales a `editValues`; `PATCH
/products/:id` sólo con los 4 campos editables (nunca manda `stock` ni
`active` — esos cambian por otros flujos: ventas/compras y soft-delete).

**Eliminar:** soft-delete vía `DELETE /products/:id` (igual que el backend:
la fila desaparece de la lista local pero no es un hard delete). Pasa por
`<ConfirmDialog>`. Si falla, el diálogo se cierra **antes** de mostrar el
toast de error — hacerlo en el otro orden deja el toast renderizando detrás
del backdrop del modal y el usuario no ve nada (comentario explícito en el
código, repetido igual en `sales.md`).

`stock` y `avgCost` son sólo lectura acá — se muestran (`stock`) pero nunca
se editan desde este formulario; el backend los recalcula en cada
compra/venta (ver `docs/backend/product.md` y `purchase.md`).

## Validación

Sólo `required` en `name` y `price` (HTML5). `price` usa
`inputMode="decimal"` para teclado numérico en mobile pero sigue siendo un
`<input type="text">` — no hay `type="number"`, evita el comportamiento
inconsistente de los steppers nativos con decimales. Ninguna validación de
formato numérico en el cliente: un `price` no numérico llega tal cual al
backend y depende de éste rechazarlo.

## Tests

`page.test.tsx` cubre: redirecciones de guard (sin token, sin negocio
activo); alta de producto agrega la fila sin refetch; edición inline guarda
y sale del modo edición; eliminar pasa por el diálogo de confirmación y
quita la fila; fallo al eliminar cierra el diálogo y muestra el toast de
error en vez de dejar la fila.
