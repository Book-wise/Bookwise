# Estandarización de UI — auditoría de la deuda (2026-11-04)

P0 del pedido del mantenedor: «quiero que la app empiece a lucir estandarizada o igual, no
deberíamos tener dos tablas que luzcan muy diferentes». **Esta sesión no cambia código**: mide y
prioriza. El plan de ejecución está al final y espera decisión.

Fuentes: `design/system.md` (tokens), `src/styles/*` (capas globales), `src/app/**/*.scss`
(64 archivos), y el relevamiento de tablas/diálogos del repo.

---

## 1. Lo que hay hoy

| Capa | Qué tiene | Estado |
|---|---|---|
| Tokens | `_tokens.scss` (~120 variables: marca, superficies, tipografía, radios, sombras, z-index) | ✅ ordenada, es la identidad |
| Temas | `styles.scss`: `body.dark-theme` y `body.theme-kinesilk` redefiniendo las mismas variables | ✅ consistente |
| Primitivas globales | `_cards.scss` (`.bw-card`), `_badges.scss` (`.bw-chip`), `_buttons.scss` (`.bw-day-btn`, `.bw-icon-btn`), `_tables.scss` (4 recetas) | ⚠️ incompletas y con nombres de feature |
| PrimeNG | `providePrimeNG({ theme: { preset: Aura, options: { darkModeSelector: false } } })` | ⚠️ **Aura de fábrica, nunca se le enseñó la identidad ni el modo oscuro** |
| Componentes compartidos | 14 carpetas (header, layouts, patient-card, configuraciones, diálogos de sistema) | ❌ **no hay primitivas** de tabla, card, chip ni botón |

### Tablas: 10 con PrimeNG, 3 nativas

| Pantalla | Implementación | Estilos propios |
|---|---|---|
| `locations`, `providers`, `clients`, `historial-paciente` | `p-table` | ninguno (heredan Aura + el override global) |
| `historial-pagos` (2 tablas), `payment-tab` (2 tablas) | `p-table` | `.hpg-items-table`, `.hpg-txn-table`, `.bw-detail-table`, `.bw-txn-table` |
| `billing-history` | `<table>` nativo | `.invoice-table` |
| `packs` | `<table>` nativo ×2 | `.sp-table` + `.sp-subtable` |

**El diagnóstico no es «cada pantalla inventó su tabla».** Hay **dos** problemas distintos:

1. **Dos looks conviviendo**: las 6 `p-table` de listados (locations, providers, clients,
   historial-paciente) heredan Aura + el override global; las 4 de pagos heredan además una receta
   nombrada (`.hpg-*`, `.bw-*-table`); las 3 nativas tienen receta propia. Tres familias visuales.
2. **`_tables.scss` se comió nombres de feature**: `.hpg-items-table` y `.hpg-txn-table` son
   «historial de pagos», no primitivas. El comentario de cabecera del archivo
   («Components consume these globally — no local table recipes remain») **es falso hoy**.

Además `styles.scss:324-352` fuerza en **todas** las `p-table`:

```scss
white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px;  // th y td
```

Eso es el override que hace que las `p-table` no puedan lucir como el diseño (celdas truncadas a
180 px) y es la razón por la que las pantallas nuevas terminan usando `<table>` nativo.

### Diálogos

17 `p-dialog` en 15 archivos (11 componentes dedicados + 6 inline). **0 diálogos propios.** Conteo
sano: la deuda acá es que cada uno repite `[pt]="{ footer: { style: { paddingTop: ... } } }"` (12
usos) en vez de que el preset lo resuelva.

### `::ng-deep` y overrides de PrimeNG

- **64 `::ng-deep`** en `src/app`. Top: `booking-detail-dialog` **16**, `admin-dashboard` 11,
  `phone-input` 9, `billing` 7.
- **35 selectores `.p-*`** en `styles.scss`, incluyendo un bloque completo de modo oscuro para
  `.p-datatable` (`:126-152`) escrito a mano.
- Métricas de pass-through: sanas (12 usos, casi solo padding de footer).

Patrón: **se parchea PrimeNG por fuera (global y `::ng-deep`) en vez de configurarlo por dentro
(preset)**. Cada pantalla nueva hereda el parche, no la identidad.

---

## 2. La deuda medida (64 archivos SCSS, 13 873 líneas)

| Métrica | Total | Lectura |
|---|---|---|
| Literales de color (`#hex`/`rgb`) | **455** | muchos son tokens por valor, pero **452 literales no tienen token equivalente** |
| `font-size` literales | 396 | hay una **microescala paralela** (13px, 15px, 14,4px, 12,8px…) |
| `border-radius` literales | 117 | radios fuera de la escala (10px, 12px) |
| `box-shadow` literales | 55 | sombras re-escritas |
| `font-family` | 36 | debería ser una sola |
| `rgba()` | 108 | tintes ad-hoc en vez de `color-mix` sobre tokens |
| `::ng-deep` | 64 | ver arriba |

### Los huecos del sistema de tokens (la causa raíz)

Los literales más repetidos no son errores sueltos: son **tokens que faltan**.

| Literal | Veces | Qué es | Token propuesto |
|---|---|---|---|
| `#fff` | 22 | texto sobre relleno de marca | `--bw-text-on-brand` |
| `0.8125rem` (13 px) | 16 | tamaño intermedio muy usado | `--bw-text-md` |
| `#ef4444` | 10 | peligro sólido | `--bw-danger` |
| `0.9375rem` (15 px) | 9 | cuerpo denso | (mapear a `--bw-text-base`/`sm`) |
| `#dc2626` | 9 | **otro rojo de peligro** | `--bw-danger-strong` |
| `0.9rem` / `0.8rem` / `0.7rem` | 8 / 7 / 6 | microescala paralela | eliminar: mapear a `xs`/`sm` |
| `#9ca3af` / `#d1d5db` / `#e2e8f0` | 7 / 5 / 6 | grises fuera de paleta | `--bw-neutral-*` |
| `10px` | 6 | radio intermedio | `--bw-radius-md` ya es 6; sumar `--bw-radius-xl` o unificar |
| `#6366f1` (índigo) | 4 | color inventado (roles) | `--bw-500` |

**Dos rojos distintos para «peligro» y tres grises** es exactamente lo que se ve como «pantallas que
no son la misma app».

### Ranking por deuda (literales sin token)

| # | Archivo | Sin token | Colores | `::ng-deep` | Líneas |
|---|---|---|---|---|---|
| 1 | `features/landing/landing.component.scss` | **52** | 31 | 0 | 786 |
| 2 | `features/provider/availability/provider-availability.component.scss` | **36** | 26 | 0 | 947 |
| 3 | `features/admin/plans/plans.component.scss` | **34** | 43 | 0 | 433 |
| 4 | `features/admin/plans/my-plan.component.scss` | **33** | 36 | 3 | 341 |
| 5 | `features/admin/profile/profile.component.scss` | **32** | 16 | 2 | 592 |
| 6 | `features/admin/billing/billing.component.scss` | 27 | 23 | 7 | 390 |
| 7 | `shared/components/patient-card/patient-card.component.scss` | 19 | 14 | 0 | 670 |
| 8 | `features/admin/roles/role-permissions.component.scss` | 15 | 17 | 0 | 224 |
| 9 | `features/admin/billing/billing-history.component.scss` | 12 | 13 | 0 | 126 |
| 10 | `features/admin/dashboard/admin-dashboard.component.scss` | 11 | 12 | **11** | 372 |

Nota: `landing` es marketing y puede tener paleta propia a propósito. El resto es producto.

---

## 3. Plan propuesto (cada fase se puede soltar sola)

### F1 · Cerrar los huecos de tokens — **riesgo ~0, mayor volumen**
Agregar los tokens faltantes (`--bw-text-on-brand`, `--bw-danger`, `--bw-danger-strong`,
`--bw-text-md`, grises neutros) y **reemplazar los literales por el token con el mismo valor**.
Ningún píxel cambia; la deuda baja ~60-80 literales y las pantallas convergen.

### F2 · Una sola tabla
Colapsar las 4 recetas de `_tables.scss` en **`.bw-table`** con modificadores (`--detail`,
`--compact`, `--numbers`). Migrar las 3 nativas (`billing-history`, `packs` ×2) a `p-table` con esa
receta y `responsiveLayout="stack"` — que **reemplaza** el `packs-list-mobile.scss` que escribimos a
mano. Sacar de `styles.scss` el `max-width:180px` global (lo que trunca las celdas hoy).

### F3 · Preset Bookwise
`definePreset(Aura, …)` con marca, tipografía y densidad; `darkModeSelector: 'body.dark-theme'`.
**Borrar** los 35 selectores `.p-*` y el bloque oscuro de `.p-datatable`. Es la fase que ataca la
raíz, pero es la que más mueve píxeles: necesita pasada visual de las 10 tablas, 17 diálogos y los
3 formularios grandes.

### F4 · Guardarraíl
Regla de convención: **el SCSS de una feature es layout, no apariencia** (sin `color:`, `font-size:`,
`border-radius:` literales, sin recetas de `table/th/td`, sin `::ng-deep`). Verificable con un script
sin dependencias nuevas (`npm run lint:styles`) + el budget `anyComponentStyle` que ya existe
(warning 12 kB / error 15 kB).

---

## 4. Recomendación

**F1 → F2 → F3 → F4.** Al revés de lo que parece natural: primero los tokens porque son riesgo cero y
son la causa raíz real; después la tabla, que es el síntoma más visible; el preset al final, cuando
el resto ya esté convergido y la pasada visual sea chica.

No tocar `provider-availability` (947 líneas) ni `landing` en estas fases: son dos pantallas con
lógica de presentación propia y merecen su unidad aparte.

---

## Log

- **A1 (2026-11-04):** auditoría creada. Pedido del mantenedor: estandarizar la UI y dejar de
  esparcir CSS; «considera las tablas de locations y profesionales»; identidad Bookwise por sobre
  PrimeNG, sabiendo que hay muchas funcionalidades hechas con PrimeNG desde el inicio. Se eligió
  **auditar primero** antes de tocar código. Sin cambios de código en esta entrada.
