# Design System — hoja de ruta hacia una librería Angular

> Convención para trabajar el design system de Bookwise de forma que, en el
> futuro, pueda extraerse a una librería Angular publicable
> (`@bookwise/design-system`). Cada paso debe respetar estas reglas aunque hoy
> el código viva dentro de la app.

## 1. Frontera: qué es librería y qué es app

**Design system (futura librería):**

- Tokens: `src/styles/_tokens.scss` (los `--bw-*`, fuente de verdad).
- Bridge PrimeNG: `src/styles/_primeng-bridge.scss` (`--p-*` → `var(--bw-*)`).
- Componentes `bw-*` (standalone): `app-header`, `account-menu`,
  `agenda-navigator`, `user-avatar`, `booking-detail-dialog`,
  `booking-form-dialog`, `block-time-dialog`, `subscription-inactive-dialog`, etc.
- Pipes/directives propios (`bwCurrency`, etc.).
- Los temas de "apariencia" (`body.dark-theme`, `body.theme-kinesilk`).

**App (NO es librería):**

- Features, páginas, `core/services`, `core/stores`, `core/models`, `i18n`.
- Los estilos de negocio/feature (`_cards`, `_calendar`, `_booking-sheet`,
  `_tables`, `_badges`, `_buttons`, `_scrollbars`).

## 2. Estructura objetivo (workspace Angular)

```
projects/
  design-system/
    src/
      public-api.ts            # barrel: exporta todo lo público
      styles/
        _tokens.scss           # fuente de verdad
        _primeng-bridge.scss   # autoridad sobre PrimeNG
      lib/
        components/            # bw-* (uno por carpeta, standalone)
        pipes/
        directives/
    ng-package.json
```

Hoy el mapeo 1:1 es:

| Hoy | Futuro |
| --- | --- |
| `src/styles/_tokens.scss` | `projects/design-system/src/styles/_tokens.scss` |
| `src/styles/_primeng-bridge.scss` | `projects/design-system/src/styles/_primeng-bridge.scss` |
| `src/app/shared/components/*` | `projects/design-system/src/lib/components/*` |
| `src/app/shared/pipes/*` | `projects/design-system/src/lib/pipes/*` |

## 3. Reglas de autoridad (no negociables)

1. **`bw-*` es auto-contenido**: `standalone: true`, sin imports relativos a la
   app (`@services/*`, `@models`, `@i18n`, `@features/*`). Comunicación solo por
   `input()/model()/output()` (signals).
2. **Nada de `primeng/*` fuera del design system**: las features importan
   `bw-*`, no `p-*`. La fachada interna oculta el contrato de estado de PrimeNG.
3. **Un solo lugar para los colores**: ningún hex literal fuera de
   `_tokens.scss` (los componentes usan `var(--bw-*)`).
4. **Barrel export**: cada carpeta expone un `index.ts`; el `public-api.ts`
   final es el único punto de import.
5. **Estilos scoped**: cada `bw-*` trae su SCSS scoped; lo único global son
   tokens + bridge.
6. **Compatibilidad, no refactor**: ninguna fachada cambia el formato, la ruta
   ni el flujo de la pantalla. Entra un consumidor por commit y se revierte sin
   tocar el template. Si un componente ya es propio y funciona, no se toca; si
   un tablero del catálogo difiere de la app, gana la app. Mapa de propiedad:
   `design/kit-componentes/00-estado-y-transicion.html`.

## 4. Orden de migración (paso a paso)

- [x] **0 · Inventario** → `docs/primeng-inventory.md`.
- [x] **1 · Bridge de tokens** → `src/styles/_primeng-bridge.scss` (semánticos
  + component-specific: dialog footer, skeleton, tabs).
- [ ] **2 · Fachadas `bw-*`** (alta frecuencia + estado): `bw-button`,
  `bw-select`, `bw-dialog`, `bw-popover`, `bw-chip`, `bw-input`, `bw-skeleton`.
  Piloto ✅ `bw-dialog` (patrón en §6); siguen `bw-select` y el resto.
- [ ] **3 · Primitivas nativas**: Button, Chip, Card, Badge, Avatar → Angular
  puro + tokens (adiós PrimeNG ahí).
- [ ] **4 · Portar specs visuales** (esquinas redondeadas, alturas de header,
  botones, glass, filtro de estados, tools) sobre el kit.
- [x] **5a · Guardrail (reporte)** → `scripts/check-design-boundary.mjs`
  (`npm run check:boundary`, en CI sin bloquear) lista `primeng/*` fuera del
  kit. Cobertura y protocolo: `docs/design-system-coverage.md`.
- [ ] **5b · Guardrail (estricto)**: pasar el script a `--strict` cuando el
  conteo sea 0; auditoría de hex literales; `design/system.md` sincronizado.

## 5. Cómo se valida cada paso

- El SCSS de la librería debe compilar sin depender de estilos de la app.
- Cada `bw-*` nuevo tiene su spec (estado por signals, no por API de PrimeNG).
- `design/system.md` se re-sincroniza si cambian los tokens.

## 6. Patrón de fachada (validado con `bw-dialog`)

El piloto vive en `src/app/shared/components/bw-dialog/` y es la plantilla
para el resto de las fachadas: un componente `bw-*` que envuelve al de
PrimeNG, traduce su contrato de estado a signals y no deja escapar ni una
propiedad de PrimeNG al consumidor.

| Contrato PrimeNG | Contrato `bw-*` | Por qué |
| --- | --- | --- |
| `[(visible)]` + `(visibleChange)` | `visible = model(false)` + `dismissed` | Un solo dueño del estado: la app. `dismissed` solo sale por cierre del usuario (X, ESC, máscara); un cierre programático no dispara nada. |
| `[header]` (string) | `header = input('')` | El consumidor traduce y pasa el texto ya resuelto. |
| `pTemplate="footer"` | `footer = input<TemplateRef<void> \| undefined>(undefined)` | El pie se pasa como template; sin template, PrimeNG no reserva altura. |
| `[style]` / `[contentStyle]` | `width`, `maxWidth` | Nada de CSS crudo en las features; lo que falte se agrega como input semántico. |
| `[modal]`, `[closable]`, `[dismissableMask]` | mismos nombres, `booleanAttribute` | Se conservan porque son comportamiento, no apariencia. |

Reglas del patrón:

1. **El consumidor nunca importa `primeng/dialog`** (ni ningún `primeng/*`
   fuera del kit). Importa `BwDialogComponent` desde el barrel de la carpeta.
2. **Ningún `pTemplate`** en las features: el footer es un `TemplateRef`
   pasado por input.
3. **El estado se lee por signals** (`visible()`, `header()`), nunca por la
   instancia de PrimeNG.
4. **Toda la traducción de nombres vive en la fachada**: si PrimeNG renombra
   `visibleChange` o cambia el template del footer, se toca un archivo.

Spec de referencia: `bw-dialog.component.spec.ts` monta un host con
`[(visible)]` y verifica apertura, header, cuerpo proyectado, footer opcional,
cierre del usuario (actualiza el modelo y emite `dismissed`) y cierre
programático (no emite). Ese es el mínimo que debe traer cada fachada nueva.
