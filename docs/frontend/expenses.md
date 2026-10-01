# expenses

Registro y listado de gastos del negocio activo, en `/dashboard/expenses`.
Página más simple que `sales`: sin cálculos client-side, sin eliminar, sin
filtro de fecha.

**Archivos:** `app/dashboard/expenses/page.tsx`,
`app/dashboard/expenses/page.test.tsx`.

## Comportamiento

Guard doble igual que `products`/`sales` (token → `/login`, negocio activo
→ `/dashboard`). Al montar: `GET /expenses?businessId=<id>` (ver
`docs/backend/expense.md`), sin `page`/`from`/`to` — siempre pide la
primera página, default `limit=50` del backend.

**Crear gasto:** `POST /expenses` con `businessId`, `amount`,
`description`. Éxito: antepone el gasto al listado
(`[created, ...(prev ?? [])]`, más reciente primero), limpia el formulario,
toast "Gasto registrado". **No** vuelve a pedir `/expenses` tras crear (a
diferencia de `sales`, que sí refresca productos tras vender) — confía en
el objeto devuelto por el `POST`.

**Lista truncada, no paginada:** la página captura `total` de la respuesta
y, si `total > expenses.length`, muestra "Mostrando X de Y gastos." debajo
de la lista — sin botón "cargar más" ni filtro por fecha, es sólo un aviso.
Pasado el gasto 51 de un negocio, los más viejos dejan de mostrarse sin más
alternativa que consultar la API directamente.

**Gap conocido:** el prepend optimista de `handleCreate` no incrementa el
`total` guardado en estado — si ya había exactamente 50 gastos mostrados y
se crea uno nuevo, el conteo de "Mostrando X de Y" puede quedar
desactualizado en 1 hasta el próximo `GET` (ej. recargar la página). No
corrompe datos, es sólo el texto del aviso.

## Validación

`amount` e `description` son `required` en el HTML (`<Input required>`),
sin validación de formato adicional en el cliente — la validación real
(`@IsNumberString`, `@Length(1, 255)`, `CHECK (amount > 0)` en DB) vive en
el backend; ver `docs/backend/expense.md`.

## Tests

`page.test.tsx` cubre: guards de redirección; estado vacío cuando no hay
gastos; lista gastos existentes; crear un gasto lo antepone a la lista;
error de carga muestra el `Alert` con el mensaje de conexión. No hay un
caso que cubra el aviso "Mostrando X de Y" (requiere mockear `total` >
`data.length`, no está en los fixtures actuales).
