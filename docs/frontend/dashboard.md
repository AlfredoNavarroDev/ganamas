# dashboard

Hub post-login en `/dashboard`. Resuelve qué negocio está activo (o crea el
primero) y da acceso a `products`, `sales` y `kpis`.

**Archivos:** `app/dashboard/page.tsx`, `app/dashboard/page.test.tsx`.

## Comportamiento

`"use client"`. Guard de auth estándar (ver "Convenciones transversales" en
`README.md`): sin token, `router.replace("/login")`.

Al montar, `GET /businesses?active=true` (via `authFetch`). Tres casos
según la respuesta:

- **Sin negocios** (`data.length === 0`): muestra un formulario para crear
  el primero (`POST /businesses`). Al crear, hace `setBusinesses([business])`
  — asume que es el único, no vuelve a pedir la lista completa.
- **Con negocios**: si ya había un `businessId` guardado en `localStorage`
  y sigue existiendo en la lista devuelta, lo mantiene; si no, cae al
  primero de la lista (`data[0].id`). En ambos casos persiste la elección
  con `setActiveBusinessId` (`lib/business.ts`) — este es el único lugar
  del código que decide el negocio activo "por defecto"; las demás páginas
  sólo leen lo que ya está guardado.
- **Error de red o `!res.ok`**: `loadError` con mensaje genérico, no bloquea
  el resto de la UI (los botones de navegación no aparecen porque dependen
  de `activeId`, que nunca se seteó).

Cambiar de negocio (`<Select>`, sólo visible si hay ≥1 negocio) llama a
`handleSwitchBusiness`, que sólo actualiza `localStorage` + estado local —
no dispara ningún refetch en esta página (las páginas hijas son las que
leen el nuevo valor la próxima vez que montan).

Los tres botones de navegación (Productos/Ventas/Resumen) sólo se renderizan
si `activeId` no es null — no tiene sentido navegar a ellas sin negocio
activo, y de hecho esas páginas redirigen de vuelta acá si no lo encuentran.

`handleLogout` limpia el token (no limpia el negocio activo guardado —
si el mismo usuario vuelve a loguearse, ve el mismo negocio seleccionado).

## Tests

`page.test.tsx` cubre: redirección a `/login` sin token; alta del primer
negocio cuando la lista viene vacía; selección del negocio guardado si
sigue existiendo en la lista; caída al primero si el guardado ya no existe;
logout limpia el token y navega a `/login`.
