# login

Único punto de autenticación en `/login`. No hay registro público (igual
que el backend: el usuario se crea vía seed, no hay `POST /auth/register`).

**Archivos:** `app/login/page.tsx`, `app/login/page.test.tsx`.

## Comportamiento

`"use client"`. Formulario controlado (`username`, `password`) que hace
`POST ${API_URL}/auth/login` con `fetch` directo (no `authFetch` — todavía
no hay token). `API_URL` se resuelve localmente en este archivo con el mismo
fallback que `lib/api.ts` (`NEXT_PUBLIC_API_URL` o
`http://localhost:3001`), duplicado en vez de importado — no hay una sola
fuente para esa constante hoy (ver Gaps en `README.md`).

Si la respuesta no es `ok`, muestra "Usuario o contraseña incorrectos." y
devuelve el foco al campo de usuario (`usernameRef`) — no distingue 401 de
otros códigos de error, cualquier `!res.ok` cae en el mismo mensaje. Un
fallo de red (`catch`) muestra un mensaje distinto: "No se pudo conectar
con el servidor.".

Login exitoso: `setToken(data.accessToken)` (`lib/auth.ts`, a
`localStorage`) y `router.push("/dashboard")`. No guarda el negocio activo
acá — eso lo resuelve `dashboard/page.tsx` en su propio load.

Password toggle (`showPassword`) cambia el `type` del input entre
`password`/`text`; el ícono (`Eye`/`EyeOff` de `lucide-react`) y el
`aria-label` cambian junto con el estado.

## Validación

Sólo HTML5 (`required` en ambos campos) — ninguna validación de formato en
el cliente. Toda validación real (usuario existe, password correcto) es
responsabilidad del backend; el frontend sólo interpreta el status code.

## Tests

`page.test.tsx` cubre: submit exitoso guarda el token y navega a
`/dashboard`; credenciales inválidas muestra el mensaje de error sin
navegar; toggle de mostrar/ocultar contraseña cambia el tipo del input.
