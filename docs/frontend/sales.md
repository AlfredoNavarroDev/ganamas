# sales

Registro rápido de ventas y listado del día, en `/dashboard/sales`. Es la
página con más prioridad de velocidad del producto (ver README raíz).

**Archivos:** `app/dashboard/sales/page.tsx`,
`app/dashboard/sales/page.test.tsx`.

## Comportamiento

Guard doble igual que `products` (token → `/login`, negocio activo →
`/dashboard`). Al montar dispara dos cargas en paralelo:
`GET /products?businessId=<id>&active=true` (para el selector) y
`GET /sales?businessId=<id>&from=<hoy>&to=<hoy>` con el rango del día
calculado por `limaTodayRange()` (`lib/date-ranges.ts`) — la lista mostrada
es siempre "las ventas de hoy en hora de Lima", no configurable desde esta
página (comparar con `kpis`, que sí permite día/semana/mes).

**Cálculo de precio en el cliente (sólo previsualización):**

```
catalogPrice = Number(producto seleccionado . price)
fullTotal    = catalogPrice * cantidad
totalToCharge = max(fullTotal - descuento, 0)
unitPrice enviado = totalToCharge / cantidad   (2 decimales, string)
```

El campo `discount` del formulario es un **monto total en soles**, no un
porcentaje ni un precio unitario — se resta del subtotal completo y el
resultado se reparte de vuelta a un `unitPrice` implícito. Esto es
puramente para mostrarle al usuario "cuánto le cobro" antes de enviar; lo
que persiste es `unitPrice`, y el backend recalcula `discount` como columna
generada (`(list_price - unit_price) * quantity`, ver
`docs/backend/sale.md`) a partir de `list_price` (el precio de catálogo en
el momento de vender) y ese `unitPrice`. Si el backend redondeara o
validara distinto, este cálculo del cliente no lo reflejaría hasta ver la
respuesta — es una previsualización, no la fuente de verdad (ver Gaps en
`README.md`).

**Crear venta:** `POST /sales` con `businessId`, `productId`, `quantity`,
`unitPrice` (el calculado arriba), `paymentMethod`. Si falla, inspecciona
el body de error: si el mensaje incluye `"insufficient stock"` (case
insensitive) muestra "Stock insuficiente.", si no, un mensaje genérico —
es el único lugar del frontend que interpreta el contenido de un mensaje de
error del backend en vez de sólo el status code. Éxito: antepone la venta
al listado (`[created, ...(prev ?? [])]`, más reciente primero) y **vuelve
a pedir productos** (`loadProducts`) para reflejar el `stock` descontado —
la venta no actualiza el stock localmente por su cuenta.

**Eliminar venta:** `DELETE /sales/:id`, mismo patrón de
diálogo-cierra-antes-del-toast que `products`. El backend revierte el stock
al borrar (hard delete, ver `docs/backend/sale.md`), por eso acá también se
vuelve a pedir productos tras un borrado exitoso.

## Validación

`quantity` requerido, `inputMode="decimal"`, sin chequeo de stock
disponible en el cliente — el `<Select>` de producto muestra el stock
actual junto al nombre (`{product.name} ({product.stock} {product.unit})`)
como ayuda visual, pero vender más de lo que hay se descubre recién en la
respuesta 400 del backend. `discount` es opcional (`placeholder="0.00"`,
sin `required`).

## Tests

`page.test.tsx` cubre: guards de redirección; el cálculo de total a cobrar
en pantalla al cambiar cantidad/descuento; creación exitosa antepone la
venta y refresca productos; error de stock insuficiente muestra el mensaje
específico; eliminar venta pasa por confirmación y refresca productos.
