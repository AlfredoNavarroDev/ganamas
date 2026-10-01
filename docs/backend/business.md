# business

CRUD de negocios. `Business` es la entidad genérica que permite replicar la
app a otro negocio/persona sin tocar código — nunca hardcodear nombres de
negocio ("Frutas"/"Ropa") en el código, se siembran como datos.

**Archivos:** `business.controller.ts`, `business.service.ts`,
`business.module.ts`, `dto/create-business.dto.ts`, `dto/update-business.dto.ts`.

## Endpoints

Todos requieren `Authorization: Bearer <token>` (`@ApiBearerAuth()`).

| Método | Ruta | Query/Body | Respuesta |
|---|---|---|---|
| POST | `/businesses` | `CreateBusinessDto` | `Business` creado, `owner` = usuario autenticado |
| GET | `/businesses` | `?active=true\|false` (default `true`) | `Business[]` del usuario autenticado |
| PATCH | `/businesses/:id` | `UpdateBusinessDto` | `Business` actualizado |

## Comportamiento

- **Owner-scoped:** `create`/`findAll`/`update` siempre filtran por
  `owner.id = user.userId` (tomado del JWT vía `@CurrentUser()`) — un usuario
  nunca ve ni edita negocios de otro `owner` (aunque hoy solo existe un
  usuario en toda la app).
- `update` hace `Object.assign(business, dto)` — el DTO creció
  (`dailyProfitGoal`, ver abajo) desde `name`/`active`; sigue siendo seguro
  porque los tres campos son datos propios del negocio, pero si se agrega
  un campo más sensible este patrón necesita revisarse de nuevo.
- `update` sobre un `id` que no existe (o no pertenece al usuario) →
  `404 Not Found`.
- Borrado es **soft-delete** vía `PATCH { active: false }`, no hay
  `DELETE /businesses/:id` — preserva el historial de productos/ventas/compras
  asociado.

## Meta diaria (`dailyProfitGoal`)

Columna nullable agregada sobre `Business` para que el frontend muestre
progreso de ganancia del día contra una meta (ver
`docs/frontend/kpis.md`). No tiene endpoint propio — se lee/escribe vía los
mismos `GET /businesses` / `PATCH /businesses/:id` de arriba, sin lógica
nueva en el controller/service.

- Tipo `string | null` (numeric como toda cantidad de dinero en esta app).
- `CHECK (daily_profit_goal IS NULL OR daily_profit_goal > 0)` en la
  migración — un valor `0` o negativo no llega a guardarse, responde `400`
  (ver filtro global de excepciones en el README de esta carpeta).
- No participa de ningún cálculo del backend (`reports`, `closing`): es
  puramente un valor que el frontend compara contra `summary.profit` para
  pintar una barra de progreso. Registrar un gasto (`docs/backend/expense.md`)
  **no** mueve esta meta — ambas features son intencionalmente
  independientes.

## Validación

`CreateBusinessDto`: `name` — `@IsString() @Length(1, 100)`.

`UpdateBusinessDto`: `PartialType(CreateBusinessDto)` (todos los campos de
create, opcionales) + `active?: boolean` (`@IsOptional() @IsBoolean()`) +
`dailyProfitGoal?: string` (`@IsOptional() @IsNumberString()` — la
positividad la exige el `CHECK` de la DB, no el DTO).

## Constraint de esquema

`UNIQUE(owner_id, name)` en la migración — dos negocios del mismo dueño no
pueden compartir nombre. El filtro global de excepciones
(`QueryFailedExceptionFilter`, ver README) mapea esta violación a `409`.

## Tests

`business.service.spec.ts` — create/findAll/update owner-scoped, 404 en
update fuera de scope. `test/business.e2e-spec.ts` — CRUD real vía HTTP,
incluye el caso `active` filter.
