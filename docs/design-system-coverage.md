# Design system — cobertura, frontera y flujos críticos

> Estado al 2026-11-28. Es el mapa de qué está migrado, qué falta y cómo se
> migra sin romper. Se actualiza con cada fachada (una fila por componente).
>
> **Qué es:** un mapa de propiedad y deuda. **No es un rediseño:** el formato de
> las pantallas que ya funcionan se queda; la transición cambia el dueño del
> componente, un consumidor por vez, y se revierte sin tocar el template. Si un
> tablero del catálogo difiere de la app, gana la app.
>
> Contexto: `docs/design-system-library.md` (reglas y roadmap),
> `docs/primeng-inventory.md` (inventario original), `design/system.md`
> (tokens) y `design/kit-componentes/` (catálogo visual).

## 1. La frontera

- `primeng/*` solo se importa desde el kit: `src/app/shared/components/bw-*/`.
- Excepción: `src/app/app.config.ts` (`providePrimeNG()` es wiring del
  runtime, no markup ni estado).
- Las features importan `bw-*`, nunca `p-*`.
- Los `*.spec.ts` quedan fuera del conteo: un spec puede montar `p-*` para
  probar un componente legacy.

```bash
npm run check:boundary          # reporte: lista la deuda, exit 0
npm run check:boundary:strict   # exit 1 si hay deuda (para cuando sea 0)
```

CI corre el reporte en el job `tests` (`.github/workflows/ci.yml`), sin
bloquear. Cuando el conteo llegue a 0, se cambia a `--strict`.

**Hoy:** 169 archivos TS escaneados · **63 importan `primeng/*`** · 2 permitidos
(kit + provider) · **61 fuera del kit** · 280 imports totales.

## 2. Cobertura por componente

Usos = cantidad de tags en `src/**/*.html`. Archivos = archivos de producción
que importan el módulo. Estado: **kit** (propio), **fachada** (envoltorio de
estado), **alquilado** (se queda PrimeNG por posicionamiento/data), **nativo**
(Angular puro pendiente).

| Componente | Tag / API | Usos | Archivos | Estado | Próximo paso |
|---|---|---:|---:|---|---|
| Skeleton | `p-skeleton` | 166 | 22 | alquilado | reemplazar por `.bw-sk-*` (ya existe) en etapa 3 |
| Button | `p-button` | 159 | 54 | fachada | `bw-button` + nativo |
| Select | `p-select` | 53 | 24 | fachada | `bw-select` (siguiente) |
| Card | `p-card` | 32 | 18 | nativo | `bw-card` |
| Dialog | `p-dialog` | 19 | 18 | **kit** | migrar shared (`image-crop`, `subscription-inactive`), después bookings |
| Tabs | `p-tabs` · `p-tablist` · `p-tab` · `p-tabpanels` · `p-tabpanel` | 34 | 4 | fachada | `bw-tabs` (`activeIndex` → `active = model(id)`) |
| Message | `p-message` | 12 | 8 | fachada | `bw-message` |
| Datepicker | `p-datepicker` | 12 | 6 | alquilado | se queda (calendario + posicionamiento) |
| ToggleSwitch | `p-toggleswitch` | 10 | 7 | fachada | `bw-toggle` |
| Table | `p-table` | 10 | 6 | alquilado | se queda (data table) |
| Popover | `p-popover` | 9 | 7 | fachada | `bw-popover` (posicionamiento alquilado) |
| InputNumber | `p-inputnumber` | 8 | 4 | fachada | `bw-number` (CLP) |
| Checkbox | `p-checkbox` | 8 | 7 | fachada | `bw-checkbox` |
| Accordion | `p-accordion` | 8 | 1 | alquilado | `bw-accordion` si se multiplica |
| Password | `p-password` | 6 | 4 | fachada | `bw-password` (reveal) |
| Paginator | `p-paginator` | 5 | 3 | alquilado | `bw-paginator` |
| RadioButton | `p-radiobutton` | 4 | 4 | fachada | `bw-radio` |
| MultiSelect | `p-multiselect` | 4 | 4 | alquilado | fachada tardía |
| Chart | `p-chart` | 3 | 2 | alquilado | se queda (chart.js) |
| Toast | `p-toast` + `MessageService` | 2 | 2 | alquilado | `bw-toast` adapter |
| Menu | `p-menu` | 2 | 2 | fachada | `bw-menu` |
| ConfirmDialog | `p-confirmdialog` | 2 | 2 | fachada | `bw-confirm` |
| ProgressBar | `p-progressbar` | 2 | 1 | fachada | `bw-progress` |
| AutoComplete | `p-autocomplete` | 1 | 1 | alquilado | fachada tardía |
| Tooltip | `pTooltip` (directiva) | — | 10 | alquilado | `bw-tooltip` si hace falta |
| IconField / InputIcon | `p-iconfield` / `p-inputicon` | 2 | 1 | nativo | wrapper propio |
| InputText | `pInputText` (directiva) | — | 22 | fachada | `bw-input` |
| Textarea | `pTextarea` (directiva) | — | 5 | fachada | `bw-textarea` |
| API | `primeng/api` (MessageService, ConfirmationService, MenuItem) | — | 27 | servicio | no es componente; se va con toast/confirm/menu |

## 3. Dónde vive la deuda (61 archivos)

| Área | Archivos |
|---|---:|
| `features/admin/bookings` | 12 |
| `shared/components` | 12 |
| `features/auth` | 5 |
| `features/admin/billing` | 4 |
| `features/admin/clients` | 4 |
| `features/admin/business` | 3 |
| `features/admin/roles` | 3 |
| `features/admin/locations` | 2 |
| `features/admin/packs` | 2 |
| `features/admin/plans` | 2 |
| `features/admin/providers` | 2 |
| `features/provider` | 2 |
| `layouts` | 2 |
| `core`, `calendar`, `dashboard`, `onboarding`, `profile`, `billing-public` | 1 c/u |

El listado archivo por archivo (con sus módulos) lo imprime
`npm run check:boundary`.

## 4. Protocolo de migración (no romper)

1. **Una fachada por rama, un consumidor por commit.** Nunca dos pantallas en
   el mismo cambio.
2. **Paridad antes de tocar el consumidor.** Tabla corta por componente:

   | Aspecto | Hoy (PrimeNG) | Fachada `bw-*` | Evidencia |
   |---|---|---|---|
   | Entrada de estado | `[(ngModel)]` / `[(visible)]` | `value = model()` / `visible = model()` | spec |
   | Salida de cambio | `(onChange)` / `(visibleChange)` | `changed` / `dismissed` | spec |
   | Textos | keys de i18n | los mismos keys | diff de template |
   | Estados visuales | default/hover/focus/error/disabled | los mismos | checklist manual |
   | Teclado / foco | nativo PrimeNG | igual o mejor | checklist manual |

3. **Prohibido migrar + rediseñar en el mismo commit.** El cambio visual va
   aparte y se revisa aparte.
4. **Guardrail en reporte, no en error.** `--strict` recién cuando el conteo sea
   0; si arranca en error, el ruido tapa regresiones reales.
5. **La suite completa no es señal confiable.** Hay flakiness pre-existente en
   `HEAD` (`Error: STACK_TRACE_ERROR` en specs bajo carga: 16 fallos en la
   corrida base, nombres de test distintos entre corridas). Correr el spec del
   componente en aislamiento y usar el checklist de flujos.

## 5. Checklist de flujos críticos (antes de mergear)

Marcar solo lo observado en pantalla, no lo inferido. Correr en light y en el
skin que corresponda.

| # | Flujo | Qué verificar |
|---|---|---|
| 1 | Crear reserva (agenda → nueva) | servicio → variación → sesión pagada; guarda, cierra y aparece en la agenda; el abono queda registrado |
| 2 | Editar / reagendar / cancelar reserva | los tabs Reserva/Ficha/Pagos conservan su estado al cambiar; cancelar libera el cupo; el abono queda como saldo |
| 3 | Ficha clínica | un control por tipo de campo, validaciones, guardar y reabrir; impresión A4 |
| 4 | Pagos | abono parcial y saldo; comprobante; toast de éxito y de error |
| 5 | Clientes | alta y edición (RUT, teléfono); ficha del paciente |
| 6 | Profesionales y roles | permisos por rol; `admin_general` no se otorga a quien no lo tiene |
| 7 | Sucursales | horarios, días, capacidad y CTA de límite de plan |
| 8 | Servicios y packs | crear/editar, imagen, exportación a Woo |
| 9 | Disponibilidad y bloqueos | rangos, bloqueo de un día, conflicto con reservas |
| 10 | Agenda | vistas día/semana/lista, filtros, cambio de sucursal, navegación por teclado |
| 11 | Skins | light, `body.dark-theme`, `body.theme-kinesilk` en cada pantalla tocada |
| 12 | Responsive | 390, 820 y 1440; dialog full-screen en mobile; tabla sin scroll horizontal |

Criterio de paso: mismos textos, mismos estados, mismos permisos, sin errores
nuevos en consola, foco visible y `Esc`/máscara con el mismo significado.

## 6. Validado contra la app (ego-browser)

Con sesión real en Kinesilk, el 2026-11-28:

| Vista | Lo verificado | Estado |
|---|---|---|
| Agenda desktop y 390 | 3 selects (sucursal, profesional, estado), 2 botones de icono (slot y guía), nav + Hoy, **Mes / Semana / Día** (no hay vista Lista), grilla de semana. | Corregido en 07; a11y de los dos iconos arreglada. |
| Servicios y packs | Switch **Tarjetas / Lista**, card con imagen, variaciones, aviso §7 y estado Woo; strings reales (“Sin variaciones: solo se vende suelta”, “Nunca se exportó”). | Reflejado en 05. |
| Vista Lista de servicios | Columnas: selección + chevron, Servicio (duración · variaciones), Sesiones y precios, Precio base, Estado (Activo + Woo), Acciones. | Reemplazó la tabla inventada de 05. |
| Diálogo de reserva (desktop y 390) | 720 px desktop / 371×710 en 390 (no full-screen), radius 12 px, header 80 px con selector de estado, body 65vh, footer 1.25rem, sin tabs, formularios inline de servicio/paciente. | 03 y 07 corregidos; radio tokenizado. |
| Búsqueda de pacientes | Hoy es un **`p-select` con filter** (no `p-autocomplete`); muestra nombre + email. | 06 lo declara como objetivo, no como estado actual. |

Pendiente de validación visual: confirmación de 420 (capacity-limit), toasts, chart, tooltips, tema dark y variantes Kinesilk de los tableros.

## 6. Orden siguiente

0. **Estado y transición** ✅ `design/kit-componentes/00-estado-y-transicion.html`:
   propiedad por familia, garantías de compatibilidad y orden.
1. ~~Catálogo 06/07~~ ✅ cerrado (diseño, cero producción):
   `06-seleccion-avanzada.html` (datepicker, multiselect, autocomplete + Kinesilk)
   y `07-estados-sistema.html` (4 estados de tabla, cola de toasts, tooltip,
   chart, dark y mobile).
2. `bw-select`, empezando por consumidores de bajo riesgo (formularios
   estáticos, disponibilidad) antes de `booking-form-dialog`.
3. Primitivas nativas: `button`, `chip`, `card`, `badge`, `avatar`.
4. `bw-tabs`, `bw-toggle`, `bw-input`, `bw-popover`, `bw-confirm`.
5. Alquilados: `datepicker`, `multiselect`, `table`, `paginator`, `chart`.
6. `--strict` cuando `npm run check:boundary` diga 0 + auditoría de hex fuera de
   `_tokens.scss`.
