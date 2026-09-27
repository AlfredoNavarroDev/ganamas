# closing

Cierre de día: congela un snapshot de `ReportsService.summary()` para la
fecha de hoy en Lima, para que el historial no dependa de recalcular sobre
ventas que podrían borrarse después.

**Archivos:** `closing.controller.ts`, `closing.service.ts`,
`closing.module.ts`, `dto/create-closing.dto.ts`,
`dto/today-closing-query.dto.ts`, `dto/list-closings-query.dto.ts`,
`entities/day-closing.entity.ts`.

## Endpoints

| Método | Ruta | Auth | Query/Body | Respuesta |
|---|---|---|---|---|
| POST | `/closings` | Hereda guard global | Body `{ businessId }` | `DayClosing` creado, `201` |
| GET | `/closings/today` | Hereda guard global | `?businessId=` | `DayClosing` del día, `404` si no existe |
| GET | `/closings` | Hereda guard global | `?businessId=&from=&to=` (fechas opcionales) | `DayClosing[]`, más reciente primero |

## Comportamiento

`closeToday(businessId, userId)`: calcula el rango del día **en hora de
Lima** con la misma fórmula que `ReportsService` (medianoche Lima = 05:00
UTC, ver `docs/backend/reports.md`), llama a `reportsService.summary(...)`
y guarda el resultado tal cual en la columna `snapshot` (`jsonb`) junto con
`closedDate` (el `date` de Lima, no un timestamp) y `closedBy` (el usuario
autenticado que cerró).

La restricción `@Unique(['business', 'closedDate'])` en la entidad es la
única barrera contra doble cierre — no hay chequeo previo en el servicio.
`closeToday` intenta el `save()` directo y captura el `QueryFailedError`:
si el código del driver es `23505` (unique violation), lanza
`ConflictException('El día ya fue cerrado.')`; cualquier otro error se
relanza sin envolver. Esto significa que la fuente de verdad de "ya está
cerrado" es la base de datos, no una lectura previa — evita una carrera
entre dos requests simultáneos cerrando el mismo día.

`findToday` recalcula el mismo `closedDate` de hoy y busca por
`(business, closedDate)`; si no hay fila, `NotFoundException('No hay cierre
para hoy.')` — el frontend interpreta ese 404 como "todavía no cerrado",
no como un error (ver `docs/frontend/kpis.md`).

`findAll` filtra por `businessId` y opcionalmente por rango `closedDate`
(`>= from`, `<= to`), ordenado descendente. No pagina — asume que el
volumen de cierres (uno por negocio por día) nunca crece lo suficiente
para necesitarlo.

## Validación

| DTO | Campo | Reglas |
|---|---|---|
| `CreateClosingDto` | `businessId` | `@IsUUID()` |
| `TodayClosingQueryDto` | `businessId` | `@IsUUID()` |
| `ListClosingsQueryDto` | `businessId` | `@IsUUID()` |
| `ListClosingsQueryDto` | `from`, `to` | `@IsOptional() @IsDateString()` |

Ninguna valida que `businessId` pertenezca al usuario autenticado — mismo
gap de tenancy que el resto de los módulos (ver "Gaps conocidos" en
`docs/backend/README.md`).

## Tests

`closing.service.spec.ts` cubre: cierre exitoso usa el summary de
`ReportsService` como snapshot; violación de unicidad (`23505`) se traduce
a `ConflictException`; cualquier otro error de base de datos se relanza sin
modificar; `findToday` lanza `NotFoundException` sin cierre; `findToday`
devuelve la fila cuando existe. No hay e2e-spec para este módulo — la
cobertura es sólo unitaria con el repositorio mockeado.
