# Bookwise — Design system (capturado del código)

Fuentes leídas (solo lectura, sin tocar código de la app):

| Fuente | Qué aporta |
|---|---|
| `src/styles/_tokens.scss` | paleta, superficies, tipografía, espaciado, radios, sombras, z-index |
| `src/styles.scss` | reset, tema oscuro (`body.dark-theme`), tema Kinesilk (`body.theme-kinesilk`), reglas globales de diálogo/tabla, banner de cupo |
| `src/styles/_badges.scss` | `.bw-chip` + variantes |
| `src/styles/_cards.scss` | `.bw-card` + variantes |
| `src/styles/_buttons.scss` | `.bw-day-btn`, `.bw-icon-btn` |
| `src/styles/_tables.scss` | `.bw-detail-table`, `.bw-txn-table`, `.hpg-items-table`, `.hpg-txn-table` |
| `src/styles/_booking-sheet.scss` | `.bw-sheet` (shell del diálogo «Detalles de la Cita») |
| `src/styles/_scrollbars.scss` | scrollbars del navegador en los tres temas |

Todo lo que sigue son valores que **existen** en esas fuentes. Nada inventado.

---

## 1. Color

### 1.1 Marca (`_tokens.scss` → `:root`)

| Token | Valor | Uso |
|---|---|---|
| `--bw-900` | `#012663` | navy más oscuro; sidebar `from` |
| `--bw-800` | `#042661` | navy |
| `--bw-700` | `#0a2862` | navy |
| `--bw-600` | `#083d96` | sidebar `to` |
| `--bw-500` | `#0b3d95` | primario medio |
| `--bw-400` | `#0e3b8b` | azul |
| `--bw-300` | `#046af4` | CTA vibrante / acento de borde |
| `--bw-200` | `#60a7f0` | acento claro |
| `--bw-100` | `#dbeafe` | tinte muy claro (borde de card `--header`) |
| `--bw-50` | `#f0f6ff` | superficie tenue (cards `--header`) |

### 1.2 Alias semánticos (`_tokens.scss`)

| Token | Valor | Uso |
|---|---|---|
| `--color-primary` | `var(--bw-500)` | primario |
| `--color-primary-dark` | `var(--bw-900)` | primario oscuro |
| `--color-primary-cta` | `var(--bw-300)` | CTA |
| `--color-accent` | `var(--bw-200)` | acento |
| `--primary-color` (PrimeNG) | `var(--bw-300)` | botones/enlaces PrimeNG |

### 1.3 Estado (`_tokens.scss`)

| Token | Valor | Uso |
|---|---|---|
| `--bw-success` | `#22c55e` | éxito (chip `--success`) |
| `--bw-warning` | `#f59e0b` | advertencia (chip `--warning`, banner de cupo) |
| `--bw-status-reservado` | `#77D0FA` | estado de reserva |
| `--bw-status-confirmado` | `#ECBE51` | estado de reserva |
| `--bw-status-asiste` | `#1FB27C` | estado de reserva |
| `--bw-status-no-asistio` | `#FCCAC2` | estado de reserva |
| `--bw-status-pendiente` | `#FD8991` | estado de reserva |
| `--bw-status-en-espera` | `#1FB27C` | estado de reserva |
| `--bw-status-cancelado` | `#E3E7ED` | estado de reserva |
| `--bw-payment-paid` | `#1FB27C` | pago |
| `--bw-payment-partial` | `#ECBE51` | pago |
| `--bw-payment-unpaid` | `#FD8991` | pago |

### 1.4 Texto de chips (AA en el tinte) (`_tokens.scss`)

| Token | Valor (claro) | Valor (oscuro) |
|---|---|---|
| `--bw-chip-text-online` | `#1d4ed8` | `#93c5fd` |
| `--bw-chip-text-remaining` | `#9a3412` | `#fdba74` |
| `--bw-chip-text-success` | `#166534` | `#86efac` |
| `--bw-chip-text-warning` | `#92400e` | `#fcd34d` |
| `--bw-chip-text-danger` | `#991b1b` | `#fca5a5` |
| `--bw-chip-text-secondary` | `#374151` | `#cbd5e1` |
| `--bw-chip-text-primary` | `#0b3d95` | `#93c5fd` |

### 1.5 Superficies y texto

| Token | Claro (`_tokens.scss`) | Oscuro (`styles.scss`) | Kinesilk (`styles.scss`) |
|---|---|---|---|
| `--surface-ground` | `#f0f5ff` | `#0f172a` | `#fcf9ea` |
| `--surface-card` | `#ffffff` | `#1e293b` | `#fffdf7` |
| `--surface-border` | `#e5e7eb` | `#334155` | `#ece4cb` |
| `--bw-surface-muted` | `#f3f4f6` | `#263449` | `#f5f1de` |
| `--text-color` | `#1a2744` | `#e4e4e7` | `#3f3f33` |
| `--text-color-secondary` | `#6b7280` | `#94a3b8` | `#6f6f5c` |
| `--text-heading` | `#111827` | `= --text-color` | `#2f2f26` |
| `--text-label` | `#374151` | `#cbd5e1` | `#4a4a3c` |
| `--bw-tab-color` | `#0b3d95` | `#60a5fa` | — |
| `--bw-text-on-brand` | `#ffffff` | `#ffffff` | `#2f2f26` |

`--bw-text-on-brand` es el texto (e íconos) que va **sobre un relleno de marca**
(`--bw-300`). En claro y oscuro es blanco; en Kinesilk es oscuro porque ahí `--bw-300`
es un salmón pastel. **No usar `--surface-card` como si fuera "blanco"**: en oscuro
es `#1e293b` y el contraste sobre el CTA es pésimo.

`--bw-surface-muted` es la superficie de hover/selección. En oscuro vale `#263449`,
**más claro** que la card (`#1e293b`) para que el hover se note.

Kinesilk además redefine marca: `--bw-50 #eaf5f4`, `--bw-100 #badede`, `--bw-200 #ffbdbe`,
`--bw-300 #fea4a4`, `--color-primary #e08f8f`, `--color-primary-cta #fea4a4`, `--color-accent #87e9ce`,
`--bw-success #87e9ce`; el sidebar pasa a powder blue con **texto oscuro**
(`--sidebar-text rgba(47,47,38,0.72)`) y el CTA lleva texto oscuro: usar `--bw-text-on-brand`,
que vale `#2f2f26` en este tema.

### 1.6 Sidebar (chrome siempre oscuro por default) (`_tokens.scss`)

| Token | Valor |
|---|---|
| `--sidebar-bg-from` / `--sidebar-bg-to` | `var(--bw-900)` / `var(--bw-600)` |
| `--sidebar-text` | `rgba(255,255,255,0.68)` |
| `--sidebar-text-hover` / `--sidebar-text-active` | `#ffffff` |
| `--sidebar-hover-bg` / `--sidebar-active-bg` | `rgba(255,255,255,0.08)` / `rgba(255,255,255,0.14)` |
| `--sidebar-active-border` | `var(--bw-300)` |
| `--sidebar-divider` | `rgba(255,255,255,0.1)` |

### 1.7 Control del sidebar (flecha de colapsar/cerrar menú) (`_tokens.scss`)

El círculo de la flecha vive como token porque en Kinesilk el círculo navy con borde blanco se
leía como si fuera de otro tema.

| Token | Claro y oscuro (`_tokens.scss`) | Kinesilk (`styles.scss`) |
|---|---|---|
| `--sidebar-control-bg` | `var(--bw-700)` | `rgba(47,47,38,0.08)` |
| `--sidebar-control-fg` | `rgba(255,255,255,0.85)` | `#2f2f26` |
| `--sidebar-control-border` | `rgba(255,255,255,0.25)` | `rgba(47,47,38,0.18)` |
| `--sidebar-control-bg-hover` | `var(--bw-300)` | `#2f5d5a` |
| `--sidebar-control-fg-hover` | `#ffffff` | `#ffffff` |
| `--sidebar-control-border-hover` | `rgba(255,255,255,0.5)` | `#2f5d5a` |
| `--sidebar-control-shadow` | `var(--bw-shadow-sidebar-tab)` | `0 2px 6px rgba(47,47,38,0.16)` |
| `--sidebar-control-shadow-hover` | `var(--bw-shadow-sidebar-tab-hover)` | `0 3px 10px rgba(47,93,90,0.32)` |

---

## 2. Tipografía

- Familia: `--font-family: 'Roboto', sans-serif` (`_tokens.scss`), cargada con `@font-face` variable
  **100–900** desde `assets/fonts/...Roboto-VariableFont_wdth,wght.ttf` (`styles.scss`).
- Base: `font-size: 16px`, `line-height: 1.5` (`styles.scss`).
- Encabezados `h1..h6`: `font-weight: 500`, color `--text-color` (`styles.scss`).

### Escala (`_tokens.scss`)

| Token | rem | px | Uso declarado |
|---|---|---|---|
| `--bw-text-2xs` | 0.6875 | 11 | overlines, section labels en caps |
| `--bw-text-xs` | 0.75 | 12 | captions, helper text |
| `--bw-text-sm` | 0.875 | 14 | tablas, texto denso en diálogos |
| `--bw-text-base` | 1 | 16 | body |
| `--bw-text-lg` | 1.125 | 18 | títulos de card, cabeceras de dialog |
| `--bw-text-xl` | 1.25 | 20 | cifras monetarias inline |
| `--bw-text-2xl` | 1.5 | 24 | subtotales |
| `--bw-text-3xl` | 1.875 | 30 | KPIs del dashboard |
| `--bw-text-4xl` | 2.25 | 36 | hero / display |

### Roles semánticos (`_tokens.scss`)

| Token | Escala |
|---|---|
| `--bw-font-overline` | 2xs (11px) |
| `--bw-font-caption` | xs (12px) |
| `--bw-font-table` | sm (14px) |
| `--bw-font-body` | base (16px) |
| `--bw-font-title` | lg (18px) |
| `--bw-font-amount` | xl (20px) |
| `--bw-font-subtotal` | 2xl (24px) |
| `--bw-font-kpi` | 3xl (30px) |
| `--bw-font-display` | 4xl (36px) |

Pesos: `--bw-weight-regular 400`, `--bw-weight-medium 500`, `--bw-weight-semibold 600`,
`--bw-weight-bold 700`. Tracking: `--bw-tracking-overline 0.06em`, `--bw-tracking-tight -0.01em`.

**Regla del repo**: los componentes usan los tokens, no valores literales de tamaño.

---

## 3. Espaciado, radio, sombras, movimiento (`_tokens.scss`)

- Espaciado: `--bw-space-xs .25rem`, `sm .5rem`, `md 1rem`, `lg 1.5rem`, `xl 2rem`.
- Radio: `--bw-radius-sm 4px`, `md 6px`, `lg 8px`, `pill 999px`.
- Sombras: `--bw-shadow-card 0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)`;
  `--bw-shadow-popover 0 4px 12px rgba(0,0,0,.15)`;
  `--bw-dialog-header-shadow 0 6px 10px -6px rgba(0,0,0,.08)`;
  `--bw-dialog-content-shadow inset 0 -18px 14px -14px rgba(0,0,0,.07)`.
- Movimiento: `--bw-transition-fast .15s`, `base .2s`, `slow .3s`.
- Altura de control: `--bw-control-height: 2.5rem` (aplicada globalmente a `.p-button:not(.p-button-icon-only)`, `.p-select`, `.p-multiselect`, `input.p-inputtext` en `styles.scss`).
- z-index: `base 1`, `overlay 10`, `float 150`, `backdrop 300`, `drawer 400`, `topbar 500`
  (PrimeNG usa 1000+; nunca superar 500 para chrome de la app).

---

## 4. Componentes

### 4.1 Chip de estado `.bw-chip` (`_badges.scss`)

```
display: inline-flex; align-items: center; gap: .25rem;
font-size: var(--bw-font-table);            /* 14px */
font-weight: var(--bw-weight-medium);       /* 500 */
color: var(--chip-text-color, var(--chip-color));
background: color-mix(in srgb, var(--chip-color) 18%, transparent);
border: 1px solid color-mix(in srgb, var(--chip-color) 35%, transparent);
border-radius: var(--bw-radius-sm);         /* 4px */
padding: .1rem .5rem; line-height: 1.4; white-space: nowrap;
i { font-size: .75rem }  ·  .bw-chip__dot { 8px circle, background --chip-color }
```

Variantes: `--online` (`--blue-600 #2563eb`), `--remaining` (`--orange-600 #f97316`),
`--success` (`--bw-success #22c55e`), `--warning` (`--bw-warning #f59e0b`),
`--danger` (`--red-500 #ef4444`), `--primary` (`--bw-500 #0b3d95`),
`--secondary` (`--text-color-secondary`). Las variantes setean `--chip-text-color` para AA; un chip
decorativo pasa `--chip-color` inline y usa el acento como texto.

### 4.2 Card `.bw-card` (`_cards.scss`)

Base: `background var(--surface-card)`, `border 1px solid var(--surface-border)`,
`border-radius 8px`, `overflow hidden`.
Variantes: `--signature` (borde izquierdo 3px `--bw-300`), `--header` (fondo `--bw-50`, borde
`--bw-100`, borde izquierdo 3px `--bw-300`, sin sombra), `--active` (`box-shadow 0 0 0 2px --bw-300`),
`--elevated` (`0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)`).

### 4.3 Botones (`_buttons.scss`)

- `.bw-icon-btn`: ghost 2.25rem²–like (`padding .375rem`), `border-radius pill`, color
  `--text-color-secondary`, hover fondo `--surface-100 #f5f5f5` y texto `--text-color`.
- `.bw-day-btn`: círculo `2.25rem`, borde `--surface-border`, activo `background --bw-300` +
  texto blanco.

Botones PrimeNG: altura forzada a `--bw-control-height` (2.5rem) desde `styles.scss`.

### 4.4 Tablas (`_tables.scss`)

Sin bordes internos (`border: none !important`), densidad alta, `font-size: var(--bw-font-table)`;
`th` de tablas de detalle en `--bw-font-overline` + `text-transform: uppercase` +
`letter-spacing --bw-tracking-overline` + `--text-color-secondary` + padding `.5rem .75rem`.
`.p-datatable` (global, `styles.scss`): celdas `white-space: nowrap`, `text-overflow ellipsis`,
`max-width 180px`; en ≤1024px `max-width 140px`, `padding .5rem .75rem`, `font-size .875rem`.

### 4.5 Diálogos (`styles.scss`)

- `.p-dialog { overflow: hidden }` (recorta al border-radius).
- `.p-dialog-content { padding-top: 1.25rem; background: var(--surface-ground) }`.
- `--p-dialog-footer-padding: 1.25rem` (global, `!important`).
- Tema oscuro: header/content/footer a `--surface-card`.

### 4.6 `.bw-sheet` — shell del diálogo de la cita (`_booking-sheet.scss`)

Shell compartido por `admin/calendar` y `provider/calendar` para el diálogo «Detalles de la Cita».
Sin `::ng-deep`, sólo tokens.

- Cabecera: avatar + identidad (nombre + chip de RUT) + canales de contacto (teléfono con botón
  WhatsApp, correo). El nombre es lo único que se recorta; el chip de estado no se encoge.
- Bloques: cada uno con `background var(--surface-card)`, `border 1px solid var(--surface-border)`,
  `border-radius var(--bw-radius-lg)`. La variante `--session` lleva borde izquierdo 3px
  `--bw-300`; `--notes` usa `color-mix(in srgb, var(--bw-50) 60%, var(--surface-card))` con borde
  `--bw-100`.
- Overline de bloque: `--bw-font-overline` + mayúsculas + `--text-color-secondary`.
- Montos: `--bw-font-amount` con `--text-heading`.
- Footer: fila de acciones con `border-top 1px solid var(--surface-border)`.

### 4.7 Scrollbars (`_scrollbars.scss`)

Sin flechas y con el riel del tema, en los tres temas.

- Chromium/Safari: `*::-webkit-scrollbar` de `10px`; `::-webkit-scrollbar-button` en `display:none`
  (quita las flechas de Windows); riel `var(--bw-surface-muted)` (también `corner`); thumb
  `color-mix(in srgb, var(--text-color-secondary) 45%, transparent)` con `border 2px solid` del riel
  y `background-clip: padding-box`, hover 70%, active 85%; radio `--bw-radius-pill`.
- Firefox: bloque `@supports (-moz-appearance: none)` con `scrollbar-width: thin` y
  `scrollbar-color` (thumb, riel). El guard es necesario porque esas propiedades existen también en
  Chromium moderno y apagarían las reglas `::-webkit-scrollbar`.
- Los colores se leen con `var()` **dentro de cada regla**: un token derivado declarado en `:root`
  sustituiría con los valores de `:root` y no se re-resolvería en `body.dark-theme`.

### 4.8 PrimeNG: tabs atados a tokens (`styles.scss`)

El preset está fijo en claro (`darkModeSelector: false` en `app.config.ts`), así que `p-tabs`
resuelve `tablist` y `tabpanel` a `{content.background}` = blanco. En `body.dark-theme` se atan:
`--p-tabs-tablist-background: transparent`, `--p-tabs-tabpanel-background: transparent`,
`--p-tabs-tablist-border-color: var(--surface-border)`, `--p-tabs-tabpanel-color: var(--text-color)`,
`--p-tabs-tab-color: var(--text-color-secondary)`, `--p-tabs-tab-hover-color: var(--text-color)`,
`--p-tabs-tab-active-color` y `--p-tabs-tab-active-border-color` y `--p-tabs-active-bar-background`
en `var(--bw-tab-color)`.

### 4.9 Otros patrones globales

- Skeleton: `.bw-sk-card` con shimmer `bw-skeleton-shimmer 1.4s ease-in-out infinite`.
- Banner de cupo: `.bw-capacity-cta` — `padding .75rem 1rem`, `border-radius .5rem`,
  `background rgba(245,158,11,.12)`, color `#b45309`, `font-size .875rem`.
- Menú de acciones: `.bw-sale-menu` con hover `--bw-50`, íconos `--bw-300`, variante
  `.bw-menu-danger` en `--red-500 #ef4444`.

---

## 5. Reglas de uso

1. Colores, tamaños y radios siempre por token (`var(--bw-*)` / `var(--surface-*)`); nunca literales
   nuevos en un componente.
2. Estados: usar `.bw-chip` con su variante; no inventar paleta de estado.
3. Texto que el usuario lee en tablas → `--bw-font-table` (14px); cifras monetarias → `--bw-font-amount`.
4. Superficie de página `--surface-ground`; tarjetas y diálogos `--surface-card`.
5. Tres temas conviven (claro, `body.dark-theme`, `body.theme-kinesilk`): cualquier color nuevo debe
   ser un token con override en los tres bloques.
