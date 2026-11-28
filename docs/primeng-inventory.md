# PrimeNG Inventory — acoplamiento y autoridad

> Etapa 0 del plan de design system. Estado: inventario inicial.
> Objetivo: saber qué componentes PrimeNG usamos, cuánto nos acoplan
> (markup + estado + API) y cuáles conviene reemplazar, adaptar o seguir
> "alquilando".

## Resumen por componente

| Componente | Tags | Estado acoplado | Verdicto |
| --- | --- | --- | --- |
| skeleton | 166 | — | **nativo** (ya tenemos shimmer `.bw-sk-card`) |
| button | 160 | — | **adapter → nativo** |
| select | 54 | `[(ngModel)]` / `(onChange)` | **adapter** (estado) |
| card | 32 | — | **nativo** |
| dialog | 20 | `[(visible)]` / `(visibleChange)` | **adapter** (estado) |
| tabs (+tab/tablist/tabpanel) | ~23 | `activeIndex` programático | **adapter** |
| message | 12 | — | **nativo** |
| datepicker | 12 | `[(ngModel)]` | **alquilar** (posicionamiento + calendario) |
| toggleswitch | 10 | `[(ngModel)]` | **adapter** |
| table | 10 | — | **alquilar** (data table) |
| popover | 9 | `[(visible)]` | **alquilar** (posicionamiento) |
| inputnumber | 8 | `[(ngModel)]` | **adapter** |
| checkbox | 8 | `[(ngModel)]` | **adapter** |
| password | 6 | `[(ngModel)]` | **adapter** |
| paginator | 5 | — | **alquilar** |
| tabs/tablist/tabpanels | 4+3 | `activeIndex` | **adapter** |
| radiobutton | 4 | `[(ngModel)]` | **adapter** |
| multiselect | 4 | `[(ngModel)]` | **adapter** |
| chart | 3 | — | **alquilar** (chart.js) |
| toast | 2 | `MessageService` (imperativo) | **alquilar** |
| menu | 2 | — | **adapter** (`.bw-sale-menu`) |
| accordion | 2 | `activeIndex` | **alquilar** |
| autocomplete | 1 | `[(ngModel)]` | **adapter** |
| confirmdialog | 2 | `[(visible)]` | **adapter** |
| iconfield / inputicon | 1+1 | — | **nativo** (wrapper) |

## Módulos importados (32)

`accordion · api · autocomplete · button · card · chart · checkbox · config ·
confirmdialog · datepicker · dialog · iconfield · inputicon · inputnumber ·
inputtext · menu · message · multiselect · paginator · password · popover ·
progressbar · radiobutton · select · skeleton · table · tabs · textarea · toast ·
toggleswitch · tooltip`

## Estado acoplado (dónde PrimeNG es dueño del estado)

- **Dos vías por `ngModel`**: `select`, `multiselect`, `datepicker`,
  `inputnumber`, `checkbox`, `radiobutton`, `toggleswitch`, `autocomplete`,
  `password`, `textarea`, `inputtext`.
- **Apertura por `[(visible)]`**: `dialog`, `popover`, `confirmdialog`.
- **Índice programático**: `tabs`/`accordion` (`activeIndex`).
- **Imperativo**: `toast` (vía `MessageService`).

Estos son los puntos donde "el estado de PrimeNG se mete en el nuestro"; la
capa `bw-*` (etapa 2) debe exponerlos como `model()`/signals y ocultar la API
de PrimeNG detrás de una fachada.

## Nuestra capa (ya existente)

- **Tokens**: `src/styles/_tokens.scss` (`--bw-*`, fuente de verdad).
- **Overrides dispersos**: `src/styles.scss` (`--p-*`, `!important`,
  `body.dark-theme`, `body.theme-kinesilk`).
- **Fachada `bw-dialog`** (etapa 2, piloto):
  `src/app/shared/components/bw-dialog/` envuelve `<p-dialog>` y expone
  `[(visible)]` + `(dismissed)` + `[footer]` (TemplateRef). Primer consumidor
  migrado: `capacity-limit-dialog`, que ya no importa `primeng/dialog`.
  Patrón y reglas: `docs/design-system-library.md` §6.
- **Componentes propios `bw-*`**: `app-header`, `account-menu`,
  `agenda-navigator`, `user-avatar`, `booking-detail-dialog`,
  `booking-form-dialog`, `block-time-dialog`, `subscription-inactive-dialog`,
  etc.
- **FullCalendar** (no PrimeNG): ya customizado con `.fc .ev__*` +
  `_calendar.scss`.

## Bridge (etapa 1)

`src/styles/_primeng-bridge.scss` — mapea `--p-*` → `var(--bw-*)` en un solo
lugar (primary, radius, surfaces, text, content, form fields), en claro y en
`body.dark-theme`.
