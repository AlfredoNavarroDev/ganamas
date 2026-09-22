# reports

Corte semanal y KPIs de rentabilidad. Único módulo que usa SQL crudo
(`DataSource.query`) en vez de TypeORM QueryBuilder/repository — las
agregaciones (`date_trunc`, `AT TIME ZONE`, `EXTRACT(HOUR ...)`) son
Postgres-específicas y el SQL crudo evita ambigüedad en cómo QueryBuilder
mapea relaciones a columnas.

**Archivos:** `reports.controller.ts`, `reports.service.ts`,
`reports.module.ts`, `dto/reports-query.dto.ts`.

## Endpoints

Todos requieren `Authorization: Bearer <token>`. Ambos toman
`ReportsQueryDto`: `businessId` (`@IsUUID()`), `from`/`to`
(`@IsDateString()`, ambos requeridos).

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/reports/weekly-summary` | `{ daily[], byPaymentMethod[] }` |
| GET | `/reports/kpis` | `{ bestDay, bestHour, topProducts[], lowStock[] }` |

## `weeklySummary`

- `daily`: una fila por día (`day` como texto `YYYY-MM-DD`), con
  `revenue`/`cost`/`profit`/`discount` sumados.
- `byPaymentMethod`: revenue agrupado por `payment_method`.

## `kpis`

- `bestDay` / `bestHour`: el día/hora con mayor **profit** acumulado (no
  revenue) en el rango — `null` si no hay ventas en el rango.
- `topProducts`: top 5 productos por profit acumulado.
- `lowStock`: productos activos con `stock < LOW_STOCK_THRESHOLD` (env var,
  default `5`, leída vía `ConfigService`, umbral global — no por producto).

## Zona horaria — la regla más importante de este módulo

`sold_at` se guarda `TIMESTAMPTZ` (UTC). Perú es UTC-5 sin horario de
verano. Toda query que agrupa por día u hora convierte primero:

```sql
date_trunc('day', sold_at AT TIME ZONE 'America/Lima')
EXTRACT(HOUR FROM sold_at AT TIME ZONE 'America/Lima')
```

Una venta a las 7pm del domingo en Lima cae después de medianoche UTC — sin
esta conversión, se agruparía como lunes. El bug es silencioso (los KPIs
quedan mal, no hay error visible), así que hay un test e2e dedicado a este
caso límite exacto (ver Tests).

**El bucket de día se serializa como texto** (`to_char(..., 'YYYY-MM-DD')`),
no como timestamp — si se devuelve como `timestamp without time zone`, el
driver `pg` lo reinterpreta con la zona horaria del proceso Node al
serializar a JSON, y el día visto por el cliente puede correrse en un host
que no esté en zona Lima. Este fix se aplicó tras la revisión final de
implementación; no tocar `bestDayRows`/`daily` sin mantener el `to_char`.

**Los rangos `from`/`to` de la query NO son Lima-aware**, solo el `GROUP BY`
lo es — quien llama al endpoint debe pasar límites ya ajustados a la semana
en hora Lima, o un registro justo en el borde puede contarse en el rango
adyacente. `BETWEEN` además es inclusivo en ambos extremos.

## Gaps conocidos

- `bestDay`/`bestHour` devuelven `null` para un rango sin ventas — ese
  camino no tiene test unitario dedicado (solo se testea la SQL enviada).
- Sin chequeo de ownership sobre `businessId` (ver README de esta carpeta).

## Tests

`reports.service.spec.ts` — verifica que la SQL enviada contiene la
conversión de zona horaria y el `ORDER BY profit DESC`; mockea `DataSource`.
`test/reports.e2e-spec.ts` — contra DB real: el caso límite domingo-7pm-Lima
(se agrupa como domingo, no lunes) y el flag de low-stock en `kpis`.
