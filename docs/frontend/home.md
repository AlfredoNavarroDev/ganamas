# home

Landing pública en `/`. Sin lógica de datos: es el mensaje personal del
autor para Zuhhey y el punto de entrada a `/login`.

**Archivos:** `app/page.tsx`, `app/page.test.tsx`.

## Comportamiento

Server component (no `"use client"`, no fetch, no estado). Renderiza el
nombre del producto ("Ganamás"), la dedicatoria ("para Zuhhey") y un botón
que navega a `/login` via `<Link>` (usa el `Button` con `render={<Link />}`
y `nativeButton={false}` para que el componente de UI renderice como enlace
en vez de `<button>`, preservando navegación sin JS).

Las animaciones de entrada (`motion-safe:animate-in ...`) están escalonadas
a mano con `[animation-delay:Nms]` por elemento (75ms, 150ms, 225ms, 300ms,
375ms) en vez de con el patrón `index * 60ms` que usan las listas de
`products`/`sales`/`kpis` — acá el orden es fijo, no una lista dinámica.

## Tests

`page.test.tsx` verifica que el texto de la dedicatoria y el link a
`/login` estén presentes. No hay casos de error posibles en esta página.
