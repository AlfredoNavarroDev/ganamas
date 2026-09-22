# auth

Login del único usuario de la app y emisión/validación de JWT. No hay
registro público (`/auth/register` no existe): el usuario se crea/actualiza
vía `npm run seed:user` (`src/scripts/seed-user.ts`), leyendo
`SEED_USERNAME`/`SEED_PASSWORD` del entorno.

**Archivos:** `auth.controller.ts`, `auth.service.ts`, `auth.module.ts`,
`jwt.strategy.ts`, `guards/jwt-auth.guard.ts`, `decorators/public.decorator.ts`,
`decorators/current-user.decorator.ts`, `dto/login.dto.ts`.

## Endpoints

| Método | Ruta | Auth | Body | Respuesta |
|---|---|---|---|---|
| POST | `/auth/login` | Pública (`@Public()`) | `LoginDto` | `{ accessToken: string }` |

## Comportamiento

- `AuthService.login` busca el usuario por `username`, compara `password`
  contra `passwordHash` con `bcrypt.compare`, y si coincide firma un JWT con
  `sub` (user id) y `username` en el payload.
- Credenciales inválidas (usuario no existe o password no coincide) →
  `401 Unauthorized` con el mismo mensaje genérico en ambos casos (no revela
  cuál de los dos falló).
- `JwtAuthGuard` está registrado como `APP_GUARD` global en `AuthModule` —
  protege **todas** las rutas de la app por defecto. Solo las que llevan
  `@Public()` quedan exceptuadas (hoy, únicamente `POST /auth/login`).
- `JwtStrategy` extrae el token de `Authorization: Bearer <token>`, valida
  la firma contra `JWT_SECRET` y expone `{ userId, username }` en
  `request.user`, recuperable en cualquier controller vía el decorator
  `@CurrentUser()`.
- Expiración configurable por `JWT_EXPIRES_IN` (default `30d`). No hay
  refresh token — decisión explícita: app de un solo usuario, sesión larga.

## Validación (`LoginDto`)

| Campo | Reglas |
|---|---|
| `username` | `@IsString() @IsNotEmpty()` |
| `password` | `@IsString() @IsNotEmpty()` |

## Env vars relevantes

`JWT_SECRET` (requerido, `getOrThrow`), `JWT_EXPIRES_IN` (default `30d`),
`SEED_USERNAME`/`SEED_PASSWORD` (usados solo por el script de seed, no por
este módulo directamente).

## Tests

`auth.service.spec.ts` — login exitoso, credenciales inválidas (usuario
inexistente y password incorrecto). `test/auth.e2e-spec.ts` — login real vía
HTTP contra el usuario sembrado, y una ruta protegida sin token → `401`.
