# Bookwise Design System — tokens sincronizados 2026-11-27

Sources: `src/styles/_tokens.scss` (fuente de verdad de `--bw-*`),
`src/styles.scss` (light + `body.dark-theme` + `body.theme-kinesilk`),
`src/styles/_primeng-bridge.scss` (autoridad `--p-*` → `--bw-*`).
Fonts: Roboto variable, self-hosted desde `assets/fonts/`.

Regla madre: los componentes no usan valores literales. Solo `var(--bw-*)`,
`var(--surface-*)` y `var(--text-*)`. Ningún hex fuera de `_tokens.scss`.

## Colors — brand palette

| Token | Value | Usage |
|---|---|---|
| `--bw-900` | `#012663` | darkest navy; sidebar gradient from |
| `--bw-800` | `#042661` | navy variant |
| `--bw-700` | `#0a2862` | navy variant; sidebar control bg |
| `--bw-600` | `#083d96` | navy variant; sidebar gradient to |
| `--bw-500` | `#0b3d95` | primary mid-blue; tab color light; chip-text-primary |
| `--bw-400` | `#0e3b8b` | primary deep |
| `--bw-300` | `#046af4` | vibrant CTA; `--primary-color`; focus ring; active sidebar border |
| `--bw-200` | `#60a7f0` | light accent |
| `--bw-100` | `#dbeafe` light / `rgba(4,106,244,.22)` dark | very light tint |
| `--bw-50` | `#f0f6ff` light / `rgba(4,106,244,.1)` dark | surface tint |

En `body.theme-kinesilk` cambian `--bw-50` a `--bw-300` y los aliases de
marca; el detalle está en «Kinesilk skin».

## Colors — semantic aliases

| Token | Value | Usage |
|---|---|---|
| `--color-primary` | `var(--bw-500)` | brand primary |
| `--color-primary-dark` | `var(--bw-900)` | dark primary |
| `--color-primary-cta` | `var(--bw-300)` | CTA fills |
| `--color-accent` | `var(--bw-200)` | accent |
| `--primary-color` | `var(--bw-300)` | alias de compatibilidad PrimeNG |
| `--bw-text-on-brand` | `#ffffff` | iconos/texto sobre marca; Kinesilk lo pasa a `#2f2f26` |
| `--bw-success` | `#22c55e` | éxito inline |
| `--bw-warning` | `#f59e0b` | advertencia inline |

## Colors — status (AgendaPro) y pagos

| Token | Value |
|---|---|
| `--bw-status-reservado` | `#77D0FA` |
| `--bw-status-confirmado` | `#ECBE51` |
| `--bw-status-asiste` | `#1FB27C` |
| `--bw-status-no-asistio` | `#FCCAC2` |
| `--bw-status-pendiente` | `#FD8991` |
| `--bw-status-en-espera` | `#1FB27C` |
| `--bw-status-cancelado` | `#E3E7ED` |
| `--bw-payment-paid` | `#1FB27C` |
| `--bw-payment-partial` | `#ECBE51` |
| `--bw-payment-unpaid` | `#FD8991` |

## Colors — chip text (WCAG AA sobre tinte 18%)

| Token | Light | Dark |
|---|---|---|
| `--bw-chip-text-online` | `#1d4ed8` | `#93c5fd` |
| `--bw-chip-text-remaining` | `#9a3412` | `#fdba74` |
| `--bw-chip-text-success` | `#166534` | `#86efac` |
| `--bw-chip-text-warning` | `#92400e` | `#fcd34d` |
| `--bw-chip-text-danger` | `#991b1b` | `#fca5a5` |
| `--bw-chip-text-secondary` | `#374151` | `#cbd5e1` |
| `--bw-chip-text-primary` | `#0b3d95` | `#93c5fd` |

## Surfaces

| Token | Light | Dark | Kinesilk |
|---|--|--|--|
| `--surface-ground` | `#f0f5ff` | `#0f172a` | `#fcf9ea` |
| `--surface-card` | `#ffffff` | `#1e293b` | `#fffdf7` |
| `--surface-border` | `#e5e7eb` | `#334155` | `#ece4cb` |
| `--bw-surface-muted` | `#f3f4f6` | `#263449` | `#f5f1de` |
| `--surface-0` | — | `#1e293b` | `#fffdf7` |

## Text colors

| Token | Light | Dark | Kinesilk |
|---|---|---|---|
| `--text-color` | `#1a2744` | `#e4e4e7` | `#3f3f33` |
| `--text-color-secondary` | `#6b7280` | `#94a3b8` | `#6f6f5c` |
| `--text-heading` | `#111827` | `= --text-color` | `#2f2f26` |
| `--text-label` | `#374151` | `#cbd5e1` | `#4a4a3c` |
| `--bw-tab-color` | `var(--bw-500)` | `#60a5fa` | `var(--bw-500)` |

## Kinesilk skin (rosado, salmón y menta)

`body.theme-kinesilk` re-declara superficies, marca y chrome. Los estados de
reserva y pago (`--bw-status-*`, `--bw-payment-*`) quedan intactos a propósito:
el skin cambia la marca, no el lenguaje de estados.

### Marca y CTA

| Token | Light | Kinesilk | Uso |
|---|---|---|---|
| `--bw-300` | `#046af4` | `#fea4a4` | CTA salmón |
| `--bw-200` | `#60a7f0` | `#ffbdbe` | acento rosado |
| `--bw-100` | `#dbeafe` | `#badede` | tinte powder blue |
| `--bw-50` | `#f0f6ff` | `#eaf5f4` | tinte suave |
| `--color-primary` | `var(--bw-500)` | `#e08f8f` | primario rosado |
| `--color-primary-cta` | `var(--bw-300)` | `#fea4a4` | CTA |
| `--color-accent` | `var(--bw-200)` | `#87e9ce` | acento menta |
| `--primary-color` | `var(--bw-300)` | `#fea4a4` | alias PrimeNG |
| `--bw-text-on-brand` | `#ffffff` | `#2f2f26` | texto sobre marca |
| `--bw-success` | `#22c55e` | `#87e9ce` | éxito menta |

Hover y active del CTA: `--bw-fc-btn-bg` `#fea4a4`,
`--bw-fc-btn-hover-bg` `#f79090`, `--bw-fc-btn-active-bg` `#e97b7b` (cada uno
con su `*-border` del mismo valor). `--bw-fc-today-bg`
`rgba(186,222,218,.35)`.

### Sidebar (powder blue con texto oscuro)

| Token | Kinesilk |
|---|---|
| `--sidebar-bg-from` / `--sidebar-bg-to` | `#badede` / `#a9d3d2` |
| `--sidebar-text` / hover / activo | `rgba(47,47,38,.72)` / `#2f2f26` / `#2f2f26` |
| `--sidebar-hover-bg` / `--sidebar-active-bg` | `rgba(47,47,38,.06)` / `rgba(47,47,38,.12)` |
| `--sidebar-active-border` | `#2f5d5a` |
| `--sidebar-divider` | `rgba(47,47,38,.12)` |
| `--sidebar-control-bg` / `--sidebar-control-fg` | `rgba(47,47,38,.08)` / `#2f2f26` |
| `--sidebar-control-bg-hover` / `--sidebar-control-fg-hover` | `#2f5d5a` / `#ffffff` |
| `--sidebar-text-secondary` | `rgba(47,47,38,.6)` |

### Reglas del skin

- Sobre CTA salmón el texto es oscuro (`#2f2f26`), nunca blanco. Excepción:
  botones de severidad (danger/success/warn/info/help/contrast) conservan
  label blanco.
- `.patient-detail-content__tab--active` fuerza relleno `#fea4a4` con texto
  oscuro; sus badges y los de `.bw-pc__panel-tab--active` usan
  `rgba(47,47,38,.14)` / `.18`.
- Tabs de paciente y botón mobile: label `--text-color`; disabled
  `--text-color-secondary` con `opacity: 1` (no el `GrayText` del UA).
- `#ec4899` pertenece a `src/app/shared/utils/location-palette.util.ts`, no al
  skin. Kinesilk no define fucsia: su rosa es `#ffbdbe` / `#e08f8f` y su CTA
  `#fea4a4`.

## Typography

Roboto variable (self-hosted), base 16 px, line-height 1.5, headings weight 500.

| Token | rem | px | Usage |
|---|---|---|---|
| `--bw-text-2xs` | 0.6875 | 11 | overlines y section labels en caps |
| `--bw-text-xs` | 0.75 | 12 | captions, helper text |
| `--bw-text-sm` | 0.875 | 14 | tablas, texto denso en diálogos |
| `--bw-text-base` | 1 | 16 | body |
| `--bw-text-lg` | 1.125 | 18 | títulos de card y cabeceras de dialog |
| `--bw-text-xl` | 1.25 | 20 | cifras monetarias inline |
| `--bw-text-2xl` | 1.5 | 24 | subtotales |
| `--bw-text-3xl` | 1.875 | 30 | KPIs |
| `--bw-text-4xl` | 2.25 | 36 | hero y display figures |

Roles semánticos: `--bw-font-overline` (2xs), `--bw-font-caption` (xs),
`--bw-font-table` (sm), `--bw-font-body` (base), `--bw-font-title` (lg),
`--bw-font-amount` (xl), `--bw-font-subtotal` (2xl), `--bw-font-kpi` (3xl),
`--bw-font-display` (4xl).

Weights `--bw-weight-regular/medium/semibold/bold` = 400/500/600/700.
Tracking `--bw-tracking-overline` 0.06em, `--bw-tracking-tight` -0.01em.

## Spacing / Radius / Control

| Token | Value |
|---|---|
| `--bw-space-xs/sm/md/lg/xl` | 0.25 / 0.5 / 1 / 1.5 / 2 rem |
| `--bw-radius-sm/md/lg/pill` | 4 / 6 / 8 / 999 px |
| `--bw-radius-xl` | `12px` | diálogos (valor real de PrimeNG, tokenizado en el bridge) |
| `--bw-control-height` | 2.5rem |
| `--bw-app-header-height` | 4.1875rem |
| `--bw-transition-fast/base/slow` | .15s / .2s / .3s |

## Z-scale

`--z-base` 1 · `--z-overlay` 10 · `--z-float` 150 · `--z-backdrop` 300 ·
`--z-drawer` 400 · `--z-topbar` 500. PrimeNG arranca en 1000 para overlays:
el chrome de la app nunca pasa 500.

## Shadows

| Token | Value |
|---|---|
| `--bw-shadow-card` | `0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)` |
| `--bw-shadow-popover` | `0 4px 12px rgba(0,0,0,.15)` |
| `--bw-dialog-header-shadow` | `0 6px 10px -6px rgba(0,0,0,.08)` |
| `--bw-dialog-content-shadow` | `inset 0 -18px 14px -14px rgba(0,0,0,.07)` |
| `--bw-shadow-sidebar-toggle` | `0 2px 8px rgba(1,38,99,.3)` |
| `--bw-shadow-sidebar-tab` | `0 2px 8px rgba(1,38,99,.45)` |
| `--bw-shadow-sidebar-tab-hover` | `0 3px 12px rgba(4,106,244,.5)` |

## Sidebar chrome (always dark, skin-invariant)

`--sidebar-bg-from` `var(--bw-900)` → `--sidebar-bg-to` `var(--bw-600)`;
texto `rgba(255,255,255,.68)`, hover `.08`, activo `.14` + borde `--bw-300`;
divisores `rgba(255,255,255,.1)`; controles en `--bw-700` con borde
`rgba(255,255,255,.25)` y hover `--bw-300`.

## PrimeNG bridge (`src/styles/_primeng-bridge.scss`)

PrimeNG deja de leer la paleta Aura y lee la nuestra. Un solo archivo:

| Group | Mapping |
|---|---|
| Primary | `--p-primary-color` → `var(--primary-color)`; hover/active → `--bw-fc-btn-hover-bg` / `--bw-fc-btn-active-bg`; contraste → `--bw-text-on-brand` |
| Radius | `--p-content-border-radius` → `--bw-radius-lg`; `--p-form-field-border-radius` → `--bw-radius-md` |
| Surfaces | `--p-surface-0` → `--surface-card`; 100 → `--bw-surface-muted`; 200/300 → `--surface-border`; 500 → `--text-color-secondary`; 700 → `--text-color`; 800 → `--text-heading` |
| Text | `--p-text-color`, hover, muted y hover-muted → nuestra escala de texto |
| Content | `--p-content-background` → `--surface-card`; hover → `--bw-surface-muted`; borde → `--surface-border`; color → `--text-color` |
| Form fields | background, color, borde normal/hover/focus y placeholder → tokens Bookwise |
| Component-specific | `--p-dialog-footer-padding: 1.25rem`; skeleton y tabs en `body.dark-theme` y `body.theme-kinesilk` |

Carga: el preset de PrimeNG aterriza después de `:root`, por eso los overrides
claros usan `!important`; `body.dark-theme` gana por especificidad.

## Component rules

- **Chips**: tinte 18% (`color-mix`) + `--bw-chip-text-*`; dot + label. Nunca
  color de texto literal.
- **Tabs (PrimeNG)**: tablist transparente; activo con `--bw-tab-color`; el
  panel tampoco pinta fondo propio.
- **Dialogs**: `bw-dialog` es la fachada (etapa 2). El header usa
  `--bw-dialog-header-shadow`, el content `--bw-dialog-content-shadow`, el
  footer `--p-dialog-footer-padding`. Contrato:
  `visible: model()`, `dismissed: output()`, `footer: TemplateRef`. Nada de
  `pTemplate` ni `visibleChange` fuera del kit.
- **Sidebar**: siempre oscuro; z ≤ 500 para el chrome de la app.
- **Calendar**: cards HTML, clases `.fc .ev__*`; hora dentro de la card.
- **Botones**: un CTA primario por vista; secundario outline; ghost para
  acciones de fila; danger solo para acciones destructivas.
- **Formularios**: label 12 px arriba, control 2.5rem, helper 12 px,
  error con texto + borde (no solo color); focus ring 2 px `--bw-300`.
- **Estados vacíos**: texto + acción primaria, nunca solo ilustración.

## Notes

- `:root` vive en `_tokens.scss`; dark y Kinesilk solo re-declaran superficies,
  texto y acentos de skin. El sidebar no participa.
- La frontera librería/app la define el grafo de imports, no el prefijo `bw-`:
  kit = tokens, bridge, `bw-*` sin `@services/@models/@i18n`, pipes y directivas.
- Este documento se re-sincroniza cuando cambian `_tokens.scss`, `styles.scss`
  o `_primeng-bridge.scss`.
