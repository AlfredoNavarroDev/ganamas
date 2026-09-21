# SAP para mi hermana — Spec técnico

Contexto para Claude Code: este documento consolida todas las decisiones de diseño
tomadas antes de escribir código. Léelo completo antes de implementar cualquier
parte del backend.

## Contexto de negocio

- Usuario único (mi hermana) gestiona **dos negocios distintos**: uno de frutas y
  uno de ropa. No es multi-sede, no alterna mucho entre ambos.
- Objetivo: registrar ventas diarias, hacer corte semanal, y ver KPIs de
  rentabilidad (mejor día, mejor hora, producto más rentable).
- Pensada para ser **replicable** a otros negocios/personas más adelante — por eso
  `Business` es una entidad genérica. **Nunca hardcodear "Frutas" o "Ropa" en
  código**; se siembran como datos vía seed.
- Prioridad #1 de UI: velocidad de registro de venta. Mobile-first, componentes
  grandes y táctiles. Paleta y estilo propios, sin reutilizar Design Systems
  previos del autor.
- Plazo: ~2 semanas. Esto ya influyó en qué quedó dentro y fuera del alcance
  (ver "Explícitamente fuera de alcance" abajo).

## Stack

- Backend: NestJS + TypeORM
- Frontend: Next.js (App Router)
- DB: PostgreSQL
- Monorepo: `/backend` y `/frontend`
- Migraciones sin `synchronize` — todo cambio de esquema pasa por migración explícita

## Modelo de datos

Una venta = una fila = un producto (sin carrito ni líneas múltiples). Esto fue una
decisión explícita para mantener el registro rápido.

### Entidades y relaciones
```
User 1─N Business
Business 1─N Product
Business 1─N Sale
Business 1─N Purchase
Product 1─N Sale
Product 1─N Purchase
```

### `user`
id, username (unique), password_hash, created_at, updated_at

### `business`
id, owner_id (FK user), name, active (soft-delete), created_at, updated_at
UNIQUE(owner_id, name)

### `product`
id, business_id (FK), name, price, unit (`'unidad'` | `'kg'`), category (opcional,
para agrupar variantes como "palta hash madura" / "palta hash verde" bajo
`category='palta'` en reportes, sin afectar el registro de venta), stock,
avg_cost, active (soft-delete), created_at, updated_at

### `purchase`
id, business_id (FK), product_id (FK), quantity, unit_cost, total_cost (**columna
generada** = quantity * unit_cost), purchased_at, created_at

### `sale`
id, business_id (FK), product_id (FK), quantity, list_price (snapshot del precio
de catálogo), unit_price (precio realmente cobrado, puede ser menor por regateo),
unit_cost (snapshot de avg_cost al vender), total (**generada** = quantity *
unit_price), profit (**generada** = total - quantity*unit_cost), discount
(**generada** = (list_price - unit_price) * quantity), payment_method
(`'efectivo'` | `'yape'` | `'plin'`), sold_at, created_at

**Columnas generadas (`GENERATED ALWAYS AS ... STORED`)**: nunca se calculan en el
backend. Es responsabilidad de Postgres, evita inconsistencias entre lo que
guarda la app y lo que hay en la tabla.

### Índices
- `sale(business_id, sold_at)` — el más usado, corte semanal y KPIs filtran por
  negocio + rango de fechas
- `sale(product_id)`, `purchase(product_id)`
- `purchase(business_id, purchased_at)`
- `product(business_id, active)`, `product(business_id, category)`

## Reglas de negocio (lógica de servicio, no de esquema)

### Costo: promedio ponderado
`avg_cost` en `Product` se recalcula en **cada `Purchase`**, dentro de una
transacción con lock pesimista sobre el producto:

```
newStock = product.stock + purchase.quantity
newAvgCost = (product.stock * product.avgCost + purchase.quantity * purchase.unitCost) / newStock
```

Este promedio se calcula sobre el historial de compras, **no** descuenta lo ya
vendido del cálculo (no es inventario contable estricto tipo FIFO) — es la
aproximación correcta para el tamaño de este negocio sin la complejidad de
rastrear lotes individuales.

### Snapshot de costo y precio en cada venta
`sale.unit_cost` y `sale.list_price` se copian del producto **al momento de
vender**, nunca se recalculan después. Si el costo promedio cambia por una
compra nueva, las ganancias de ventas pasadas no se mueven solas.

### Control de stock
- Al crear una `Sale`: valida `product.stock >= quantity`. Si no alcanza,
  **rechaza la venta** (`400 Bad Request`) — asunción tomada explícitamente:
  se prioriza no vender lo que no se tiene, sobre permitir venta con warning.
- Al crear una `Sale`: descuenta `product.stock -= quantity`.
- Al borrar una `Sale` (`DELETE /sales/:id`): **revierte** el stock
  (`product.stock += sale.quantity`) antes de eliminar la fila. Sin esto el
  inventario queda descuadrado.
- Todas estas operaciones van dentro de una transacción con
  `lock: { mode: 'pessimistic_write' }` sobre el `Product`, para evitar
  condiciones de carrera si dos requests tocan el mismo producto a la vez.

### Precio de venta y regateo
`CreateSaleDto.unitPrice` es opcional. Si no se manda, el backend usa
`product.price` tal cual. Si se manda un valor menor, es un regateo — se guarda
igual en `unit_price`, y `list_price` conserva el precio de catálogo para poder
reportar cuánto se descontó (`discount`, columna generada).

No hay `CHECK` en base de datos que impida `unit_price > list_price` — un precio
puede subir por temporada/escasez y no debe bloquearse a nivel de esquema.

### Borrado
- `Sale`: hard delete (con reversión de stock, ver arriba) — corrige errores de
  tipeo sin dejar basura, no es un objeto de catálogo.
- `Product`, `Business`: soft delete vía `active = false` — preservan historial
  de ventas/compras asociado.

### Zona horaria — CRÍTICO para reportes
`sold_at` y `purchased_at` se guardan como `TIMESTAMPTZ` (UTC internamente). Perú
es UTC-5 sin horario de verano. **Toda query de reporte que agrupe por día/semana/
hora debe forzar la zona horaria de Lima**, o el corte semanal queda desfasado:

```sql
date_trunc('day', sold_at AT TIME ZONE 'America/Lima')
```

Una venta a las 7pm del domingo en Lima cae después de medianoche UTC — si se
agrupa en UTC directo, aparece como lunes. Esto es fácil de pasar por alto y el
bug resultante es sutil (los KPIs de "mejor día" quedan mal, no hay error visible).

## API

| Método | Ruta | Notas |
|---|---|---|
| POST | `/auth/login` | Único endpoint público. Resto detrás de `JwtAuthGuard` |
| GET | `/businesses` | `?active=true` por defecto |
| POST | `/businesses` | Para replicar la app a otro negocio |
| PATCH | `/businesses/:id` | Incluye toggle de `active` |
| GET | `/products` | `?businessId=&active=true` — trae `stock` y `avgCost` |
| POST/PATCH/DELETE | `/products/:id` | DELETE = soft delete |
| POST | `/sales` | Ver reglas de negocio arriba |
| GET | `/sales` | `?businessId=&from=&to=&productId=` |
| DELETE | `/sales/:id` | Hard delete + reversión de stock |
| POST | `/purchases` | Recalcula `stock` y `avgCost` del producto |
| GET | `/purchases` | `?businessId=&productId=&from=&to=` |
| GET | `/reports/weekly-summary` | Incluye revenue, cost, profit, discount, breakdown por método de pago |
| GET | `/reports/kpis` | Mejor día/hora, top productos por ganancia, alerta de stock bajo |

Sin registro público de usuarios (`/auth/register` no existe). El único usuario se
crea/actualiza vía `src/scripts/seed-user.ts`, leyendo `SEED_USERNAME` /
`SEED_PASSWORD` del `.env`.

## Env vars

```
DATABASE_URL, JWT_SECRET, JWT_EXPIRES_IN, SEED_USERNAME, SEED_PASSWORD
```

## Explícitamente fuera de alcance (por ahora)

Estas dos se evaluaron y se decidió **no** incluirlas en esta versión, dado el
plazo de 2 semanas. Si se agregan después, seguir el mismo patrón que `Purchase`:

- **Mermas/pérdidas** (`stock_adjustment`): fruta que se pudre, ropa dañada, robo.
  Tabla espejo de `purchase` pero restando stock en vez de sumar, con
  `unit_cost` snapshot para reflejar la pérdida como gasto real en los reportes.
- **Fiado / venta a crédito**: requeriría entidad `Customer` + estado de pago
  (`paid`/`pending`) en `Sale`, o tabla de cobros pendientes aparte. Es una
  expansión real del alcance, no un campo suelto — no improvisar esto dentro de
  `Sale` sin planearlo primero.

Otros border cases identificados pero sin cambio de esquema, resueltos como
lógica de frontend/servicio: doble-tap accidental en el registro de venta
(debounce + estado "guardando..." en el botón).

## Archivos ya generados (en este paquete)

- `data-source.ts` — config de TypeORM para la CLI
- `src/migrations/*.ts` — 5 migraciones, en orden de dependencia de FK
- `src/entities/*.entity.ts` — User, Business, Product, Purchase, Sale
- `src/dto/*.dto.ts` — Login, CreateProduct, CreatePurchase, CreateSale
- `src/scripts/seed-user.ts` — seed del usuario único

Pendiente de implementar: modules/controllers/services de NestJS que consuman
estas entidades y apliquen las reglas de negocio de arriba, y los endpoints de
`/reports`.
