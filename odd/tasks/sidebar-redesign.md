# Sidebar y su interacción de abrir/cerrar

Diseño: `design/sidemenu/` (3 artboards; elegido `01-rail-hover-expand.html`).
Estado (2026-11-12): layout, panel y hamburguesa implementados (T1-T3, en `c15b3f9` +
fixes de tema/mobile). Los controles de FullCalendar (T4/T5, S6-S8) **siguen pendientes**: el
componente del calendario no cambió contra `develop`.

## Specs

- **S1 (seba, verbatim):** «no me gusta que en las versiones mobile el sidemnu tenga un scroll busca
  retomar espacio para que no tenga ese scroll hacia abajo, cuando al parecer todos los elementos
  caben en la pantalla» — el drawer no debe scrollear.
- **S2 (seba, verbatim, screenshot cerrado):** «mira lo que ha hecho google para abrir y cerrar ,,,
  aqui esta cerrado cuidado que la primera barra a la izquierda son tabs del navegador» — la
  hamburguesa es un botón inline en la cabecera; la cabecera no reserva ancho para el menú.
- **S3 (seba, verbatim, screenshot abierto):** «luego cuando lo abres queda asi» — al abrirlo el panel
  **empuja** el contenido; **no** hay scrim ni oscurecimiento en desktop, el calendario sigue legible.
- **S4 (seba, verbatim):** «esto seguiria siendo el icono de bookwise» + «esto seguiria siendo el logo
  en letras de bookwise» + «deja solo este, descarta el otro» — en la cabecera va **solo el wordmark**
  (`logo_side_transparente.png`), sin el icono.
- **S5 (seba, verbatim):** «no encuentro necesario esto ya que has reducio efectivamente el calendario
  de tamaño» — el mes no lleva cabecera plegable; es una tarjeta fija.
- **S6 (seba, verbatim):** «altisima atencion con que hay elementos de control de fecha que estan por
  dentro del full-calendar, tendriamos que hacer que algunos de los botones e informacion que hoy
  estan dentro se muevan hacia arriba como el control que dice hoy las flechas de cambio eso nos
  dejaria un poco mas de espacio para el calendario (...) pero debemos cablear las interacciones
  corractemente desde angular hacia el full-calendar, esto no es para que rediseñes sino para
  considerar en la implementacion».
- **S7 (seba, verbatim):** «quiero que sean un select no que aparezcan los tres» — el selector de vista
  (Mes / Semana / Día) es un `<select>`, no tres botones.
- **S8 (seba, verbatim):** «deja bloquear horario y nueva reserva cerca el uno del otro y con sus
  iconos».
- **S9 (seba, verbatim):** «aplicariamos aca uno de los temas prueba el color original que tenia de
  azul» — el botón de menú en estado **abierto** usa `--bw-700` (el navy del control original).
- **S10 (seba, verbatim):** «aunque te vi ponerle algunos gradients sutiles entre los azules de la
  marca bookwise» — el panel retoma el gradiente de marca
  (`--sidebar-bg-from` → `--sidebar-bg-to`).
- **S11 (seba, verbatim):** «me gusta que has hecho mas solido y simple como se ve el software, pero
  te llevaste por completo la navegacion del sidemenu original, necesitamos que eso vuelva» — la
  navegación original (Dashboard, Ubicaciones, Profesionales, Agenda, Clientes, Servicios y packs +
  cerrar sesión) vuelve como bloque principal del panel.

- **S12 (seba, verbatim):** «highligth del dia actual esta importante de recordar» — el día actual va
  resaltado en el mes del panel con `--bw-300` sobre texto blanco, igual que
  `.navigator__day--today` en `bw-agenda-navigator`; el seleccionado usa el tinte al 28% con anillo
  interior. Esos dos estados ya existen en el componente y no se deben perder al moverlo al panel.

- **S13 (seba, verbatim):** «debemos darle el card de background que tenia antes porque en tema oscuro se
  rompio, como es fondo transparente necesita un blanco de fondo, o un blanco con menor opacidad» — el
  wordmark (`logo_side_transparente.png`) es un PNG **transparente con tinta navy**: sobre
  `--surface-card` en `body.dark-theme` (#1e293b) desaparece. Va sobre una **placa clara**
  (`rgba(255,255,255,.88)`, radio 8px, padding), la misma idea del viejo `.logo-wrapper` del sidebar.

## Restricciones

- Solo tokens de `design/system.md`. Tres temas: claro, `body.dark-theme`, `body.theme-kinesilk`.
- El mes reusa `bw-agenda-navigator` (ya existe, tarjeta clara sobre el gradiente).
- No se pierde funcionalidad del header actual: selector de negocio, selector de tema
  (`appearanceOptions`) y menú de cuenta se conservan.

## Tasks

| # | Tarea | Specs | Estado | Commit |
|---|---|---|---|---|
| T1 | Layout de dos filas: cabecera a todo el ancho y cuerpo `panel + contenido` | S2, S3 | ✅ hecho | `c15b3f9` |
| T2 | Panel: nav original + mes (tarjeta, sin plegable) + cerrar sesión, sobre gradiente de marca | S5, S10, S11 | ✅ hecho | `c15b3f9` |
| T3 | Hamburguesa global en la cabecera; abierto con `--bw-700`; desktop empuja, mobile drawer con scrim | S1, S2, S3, S4, S9 | ✅ hecho | `c15b3f9`, `f522d14`, `6f4dde3`, `2c5ff93` |
| T4 | Controles de FullCalendar arriba: `headerToolbar: false` + `prev`/`next`/`today`/`changeView` cableados, título por `datesSet` | S6, S7 | ⏳ pendiente | — |
| T5 | Barra del calendario: select de vista + «Nueva Reserva»/«Bloquear Horario» juntos y con iconos | S7, S8 | ⏳ pendiente | — |
| T6 | Verificación: `ng build` + specs de layout, calendario y provisión | S1-S11 | ◐ parcial — `ng build` OK y `admin-layout.component.spec` (237 líneas) en `c15b3f9`; los specs de calendario recién aplican con T4/T5 | `c15b3f9` |

## Log

- **L1 (2026-11-10, usuario, verbatim):** «en el sidepanel a la izquierda cuando estamos en mobile, no
  escondamos el calendario» — primer reporte; resultó ser el mini calendario que no se montaba con
  `isMobile()`. Parche previo: montarlo con el drawer abierto y hacer scrollear el drawer entero.
- **L2 (2026-11-10, usuario, verbatim):** «no me gusta que en las versiones mobile el sidemnu tenga un
  scroll busca como retomar espacio» (S1) — el parche de L1 introdujo scroll; el rediseño lo resuelve
  sacando el calendario del flujo de altura fija.
- **L3 (2026-11-10, usuario):** once comentarios de canvas sobre `design/sidemenu/01-...`, aplicados en
  orden: patrón de hamburguesa de Google (S2), panel que empuja (S3), marca/wordmark (S4), sin
  plegable del mes (S5), requisito de FullCalendar (S6), select de vista (S7), acciones juntas con
  iconos (S8), azul del botón abierto (S9), gradiente del panel (S10), navegación original de vuelta
  (S11).
- **L5 (2026-11-10, dos specs más del canvas):** el **selector de negocio** se conserva tal cual está
  hoy en `app-header` (monograma + nombre + `RUT:` + chevron; sólo monograma en mobile) y el **selector
  de tema** pasa a ir **después** del selector de vista, pegado al menú de cuenta. Orden final de la
  barra: `[☰] [wordmark] [negocio] … [Hoy] [‹] [›] [vista] [tema] [cuenta]`.
- **L4 (2026-11-10, handoff):** artboard 01 elegido e implementación arrancada. Desvío declarado: los
  controles de calendario (S6/S7) **no** van al `app-header` global —`bw-app-header` se renderiza una
  sola vez para todo el admin— sino a la barra propia del calendario (donde ya viven
  `.filters`/`.calendar-actions`). Así se recupera el alto del `headerToolbar` sin filtrar controles de
  calendario en Dashboard, Clientes, etc.
- **L6 (2026-11-12, cierre de estado y slices):** T1-T3 quedan cerrados con sus commits
  (`c15b3f9` layout/panel/hamburguesa, `f522d14` tokens del control, `6f4dde3` drawer 240px,
  `2c5ff93` mini calendario visible en mobile). **T4/T5 no se implementaron**: `full-calendar.component.ts`
  no tiene diff contra `develop` y sigue con `headerToolbar`, así que la barra de calendario con
  `prev`/`next`/`today`/`changeView` + select de vista + acciones agrupadas queda como deuda declarada
  de esta entrega, no como algo incluido. T6 se cumple en la parte de layout (`ng build` OK y
  `admin-layout.component.spec`); la verificación de calendario depende de T4/T5.
  **Decisión de entrega (usuario, verbatim):** «arranca el PR actualiza los docs y pushea la rama luego
  los slices, dale» — el PR de corrección de suite (`chore/suite-green`, PR #47) va primero y los slices
  de la ficha se encadenan sobre él.
