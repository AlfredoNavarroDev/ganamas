# kpis

Resumen de rentabilidad y cierre de día, en `/dashboard/kpis`. Es la única
página con pestañas de rango (día/semana/mes) y la única que escribe un
"cierre" además de leer datos.

**Archivos:** `app/dashboard/kpis/page.tsx`,
`app/dashboard/kpis/page.test.tsx`.

Esta página llama a `GET /reports/summary` (ver `docs/backend/reports.md`)
y a `GET|POST /closings*` (ver `docs/backend/closing.md`) para el detalle
de reglas de negocio del lado del servidor.

## Comportamiento

Guard doble igual que `products`/`sales`. Dos efectos separados:

1. Al montar: `loadTodayClosing` (`GET /closings/today?businessId=<id>` —
   un 404 se interpreta como "todavía no cerrado hoy", no como error) y
   `loadHistory` (`GET /closings?businessId=<id>`). Ambos son
   best-effort: si fallan, se tragan el error en un `catch` vacío
   (comentado explícitamente como "no crítico para el flujo principal") en
   vez de mostrar un `Alert` — a diferencia de todas las demás cargas de
   esta app, que sí muestran `loadError`.
2. Cuando cambia `activeTab` (`day`|`week`|`month`) o `businessId`:
   `loadSummary`, que resuelve el rango con `rangeForTab` (delega a
   `limaTodayRange`/`limaWeekRange`/`limaMonthRange` de
   `lib/date-ranges.ts`) y pide `GET /reports/summary?businessId=&from=&to=`.
   Cada cambio de pestaña limpia `summary` a `null` antes de pedir — se ve
   el skeleton otra vez en cada cambio de tab, no queda el dato viejo en
   pantalla mientras carga el nuevo.

**Cerrar el día** (sólo visible en la pestaña "Día"): `POST /closings` con
`{ businessId }`. Tres resultados posibles:

- `201`: guarda el cierre devuelto en `todayClosing` y lo antepone a
  `history`; el botón pasa a mostrar la hora de cierre y queda
  deshabilitado (`disabled={closing || todayClosing !== null}` — no se
  puede cerrar dos veces desde la UI).
- `409`: toast "El día ya estaba cerrado." y vuelve a pedir
  `loadTodayClosing` — cubre la carrera de dos pestañas/dispositivos
  cerrando el mismo día.
- Cualquier otro error o fallo de red: toast genérico, el botón vuelve a
  quedar habilitado.

El historial de cierres (`<details>` colapsable, estilo "glass" con las
variables `--glass-*`) sólo muestra `closedDate` y el snapshot de
`revenue`/`profit` de cada cierre — no re-consulta `/reports/summary` para
fechas pasadas, confía en el snapshot guardado al momento del cierre.

## Datos mostrados por `summary`

`revenue`, `profit`, `count` (número de ventas), `avgTicket`, `topProduct`
(o `null` si no hubo ventas en el rango) y `byPaymentMethod[]` (lista, no
mapa — se itera directo, vacía se muestra como "Sin ventas en este
período." en vez de una tabla vacía).

## Tests

`page.test.tsx` cubre: guards de redirección; cambio de pestaña dispara
nueva carga de `summary` con el rango correcto; botón de cierre deshabilita
tras un cierre exitoso; respuesta 409 muestra el toast específico sin
romper el botón; historial se renderiza a partir de `GET /closings`.
