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
- `update` hace `Object.assign(business, dto)` — seguro solo porque
  `UpdateBusinessDto` es un DTO angosto (`name` opcional + `active`
  opcional); si el DTO creciera con campos más sensibles, este patrón
  necesitaría revisarse.
- `update` sobre un `id` que no existe (o no pertenece al usuario) →
  `404 Not Found`.
- Borrado es **soft-delete** vía `PATCH { active: false }`, no hay
  `DELETE /businesses/:id` — preserva el historial de productos/ventas/compras
  asociado.

## Validación

`CreateBusinessDto`: `name` — `@IsString() @Length(1, 100)`.

`UpdateBusinessDto`: `PartialType(CreateBusinessDto)` (todos los campos de
create, opcionales) + `active?: boolean` (`@IsOptional() @IsBoolean()`).

## Constraint de esquema

`UNIQUE(owner_id, name)` en la migración — dos negocios del mismo dueño no
pueden compartir nombre. Hoy esta violación no está mapeada a un DTO
(`@IsString`/`@Length` no la detecta), así que un duplicado responde
`500` en vez de `409` — ver gaps conocidos en el README de esta carpeta.

## Tests

`business.service.spec.ts` — create/findAll/update owner-scoped, 404 en
update fuera de scope. `test/business.e2e-spec.ts` — CRUD real vía HTTP,
incluye el caso `active` filter.
