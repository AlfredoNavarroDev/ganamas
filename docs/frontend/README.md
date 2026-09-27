# Frontend — documentación por página

Referencia técnica del código en `/frontend/app` y `/frontend/lib`, página
por página: qué muestra, a qué endpoints del backend llama, qué guarda en
`localStorage` y qué casos de error maneja. Para las decisiones de dominio
(por qué el corte semanal usa zona horaria de Lima, por qué el costo es
promedio ponderado, etc.) ver `docs/backend/README.md` y
`docs/superpowers/specs/2026-09-21-sap-hermana-backend-design.md` — el
frontend es un consumidor de esas reglas, no las redefine.

## Páginas

| Página | Ruta | Qué hace |
|---|---|---|
| [home](./home.md) | `/` | Landing con el mensaje para Zuhhey, entrada a login |
| [login](./login.md) | `/login` | Autenticación, guarda el JWT |
| [dashboard](./dashboard.md) | `/dashboard` | Selección/creación de negocio activo |
| [products](./products.md) | `/dashboard/products` | CRUD de productos del negocio activo |
| [sales](./sales.md) | `/dashboard/sales` | Registro de ventas del día, con regateo |
| [kpis](./kpis.md) | `/dashboard/kpis` | Resumen día/semana/mes y cierre de día |

## Convenciones transversales (no repetidas en cada página)

- **Stack:** Next.js 16 (App Router) + React 19 + Tailwind CSS 4. Componentes
  UI propios en `components/ui/` (no shadcn copiado sin modificar — variantes
  con `class-variance-authority`). Gestor de paquetes `pnpm`, nunca `npm` en
  este workspace (ver raíz del repo).
- **Auth client-side, no middleware:** no hay `middleware.ts` que proteja
  rutas a nivel de servidor. Cada página de `/dashboard/*` es `"use client"`
  y en un `useEffect` llama a `getToken()` (`lib/auth.ts`); si no hay token,
  `router.replace("/login")`. Antes de que ese efecto corre, el componente
  devuelve `null` (estado `checked=false`) para no mostrar contenido protegido
  ni pelear con la hidratación SSR/cliente.
- **Estado del negocio activo:** `lib/business.ts` guarda el `businessId`
  activo en `localStorage` (`ganamas_active_business`). Las páginas
  `products`, `sales` y `kpis` lo leen en el mismo `useEffect` de guard de
  auth; si no hay negocio activo, redirigen a `/dashboard`.
- **JWT:** `lib/auth.ts` guarda el token en `localStorage`
  (`ganamas_token`), nunca en cookie — por eso no hay verificación de sesión
  en el servidor (SSR/middleware) y toda página protegida es client-side.
- **Cliente HTTP:** `lib/api.ts` expone `authFetch(path, init)`, que agrega
  el header `Authorization: Bearer <token>` a `fetch(${API_URL}${path})`.
  `API_URL` viene de `NEXT_PUBLIC_API_URL`, default `http://localhost:3001`.
  El login usa `fetch` directo (todavía no tiene token que adjuntar).
- **Fechas y zona horaria:** `lib/date-ranges.ts` calcula los rangos
  día/semana/mes **en hora de Lima** (`America/Lima`, UTC-5 fijo, sin DST) y
  devuelve límites ISO en UTC para mandarlos tal cual a los query params
  `from`/`to` del backend. La semana empieza en lunes. Ningún componente
  hace aritmética de fechas por su cuenta — todos importan de aquí.
- **Dinero:** el frontend nunca hace matemática de negocio que el backend ya
  hace (costo promedio, `profit`, columnas generadas) — sólo antevisualiza el
  total a cobrar en `sales` (`fullTotal - discountAmount`) como ayuda visual
  antes de enviar; el valor real que persiste es el que devuelve el backend.
  Montos son `string` en las respuestas (igual que en las entidades del
  backend) y se formatean con un helper local `soles()` por página, no hay
  uno compartido todavía.
- **Feedback de UI:** errores de carga se muestran con `<Alert
  variant="destructive">` inline; errores de acciones (crear/eliminar) usan
  `useToast()` (`components/ui/toast.tsx`) además o en vez de un `Alert`,
  según si hay un formulario visible que deba quedar con el mensaje puntual.
  Confirmaciones destructivas (eliminar producto/venta) pasan por
  `<ConfirmDialog>`, nunca por un `window.confirm`.
- **Skeletons, no spinners:** el estado de carga inicial de cada página es un
  `<Skeleton>` con la forma aproximada del contenido final (`data-testid`
  específico por página: `dashboard-skeleton`, `products-skeleton`,
  `sales-skeleton`, `kpis-skeleton`), no un spinner genérico.
- **Animación de entrada:** listas y tarjetas usan clases
  `motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2`
  con `animationDelay` escalonado por índice (`index * 60ms`) para que los
  items aparezcan en cascada. Respeta `prefers-reduced-motion` vía el prefijo
  `motion-safe:`.
- **Diseño "glass":** paneles secundarios (historial de cierres, toasts) usan
  las variables `--glass-bg`, `--glass-border`, `--glass-blur`,
  `--glass-shadow` definidas en `app/globals.css`, no clases Tailwind sueltas
  de opacidad/blur. Tema único **dark** — no hay modo claro implementado
  (`.dark` está forzado en `<html>` en `app/layout.tsx`).
- **Testing:** Vitest + Testing Library + `jsdom`. Cada `page.tsx` tiene su
  `page.test.tsx` al lado (no en carpeta `__tests__` separada). Mock de
  `fetch` global por test, sin mockear `lib/api.ts` — se verifica que se
  llame con la URL y el header `Authorization` esperados.

## Gaps conocidos (no bloqueantes)

- No hay revalidación ni refresh de JWT expirado: un 401 en cualquier
  `authFetch` no redirige a `/login` automáticamente, la página simplemente
  muestra "no se pudo cargar/conectar" — el usuario tiene que cerrar sesión
  manual o recargar.
- El total a cobrar que calcula `sales/page.tsx` en el cliente
  (`fullTotal - discountAmount`) es sólo una previsualización; si el backend
  recalculara distinto (redondeo, regla de negocio nueva) el frontend no lo
  notaría hasta ver la respuesta — no hay test que compare ambos cálculos.
  Ver [`sales.md`](./sales.md).
- Sin modo claro ni chequeo de contraste automatizado — el tema fue diseñado
  y probado sólo en dark.
