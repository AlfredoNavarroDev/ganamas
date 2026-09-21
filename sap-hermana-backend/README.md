# SAP para mi hermana — Base de datos

Contenido de este paquete: migraciones TypeORM, entidades, DTOs y script de seed
para el módulo de base de datos del proyecto, definidos y acordados en chat.

## Estructura

```
data-source.ts              # config de TypeORM para la CLI de migraciones
src/
  migrations/                # 5 migraciones, en orden de dependencia de FK
  entities/                  # User, Business, Product, Purchase, Sale
  dto/                       # DTOs de validación (class-validator)
  scripts/
    seed-user.ts              # crea/actualiza el usuario único vía SEED_USERNAME/SEED_PASSWORD
```

## Variables de entorno necesarias (.env)

```
DATABASE_URL=postgresql://usuario:password@localhost:5432/sap_hermana
JWT_SECRET=...
JWT_EXPIRES_IN=1d
SEED_USERNAME=...
SEED_PASSWORD=...
```

## Orden de arranque

1. `npm run migration:run` — crea las 5 tablas (user, business, product, purchase, sale).
2. `npx ts-node src/scripts/seed-user.ts` — crea el usuario inicial.
3. Seed manual (o script aparte) de los 2 `Business` iniciales: "Frutas" y "Ropa"
   — no va como migración, es dato inicial, no estructura.

## Decisiones de diseño ya cerradas (para no repetir el debate)

- Una fila de `sale` = un producto vendido (sin carrito multi-línea).
- Costo por producto: promedio ponderado (`avg_cost`), recalculado en cada `purchase`.
  Se snapshotea en `sale.unit_cost` al momento de vender — la ganancia histórica no
  se recalcula sola cuando cambia el costo actual.
- `sale.list_price` vs `sale.unit_price`: permite registrar regateo/descuento sin
  perder de vista el precio de catálogo.
- Columnas `total`, `profit`, `discount` en `sale` y `total_cost` en `purchase` son
  **generadas por Postgres** (`GENERATED ALWAYS AS ... STORED`), nunca calculadas
  en el backend — evita inconsistencias.
- Control de stock: SÍ (bloquea venta sin stock suficiente; se revierte al borrar una venta).
- Mermas (`stock_adjustment`) y fiado/crédito a clientes: **diferidos**, no están en
  este esquema. Se agregan después con el mismo patrón que `purchase`.
- Registro de usuarios: sin endpoint público, solo vía seed script (app de un solo
  usuario por negocio).
- Zona horaria: las queries de reportes deben agrupar con
  `sold_at AT TIME ZONE 'America/Lima'`, no en UTC directo, o el corte semanal
  queda desfasado.
