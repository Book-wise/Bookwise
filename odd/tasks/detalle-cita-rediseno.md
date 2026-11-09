# Diálogo «Detalles de la Cita» — rediseño de la tarjeta

Rama: `feat/booking-detail-card-redesign` (desde `develop`, WIP de otra rama guardado aparte).
Diseño: `design/detalle-cita/`. Fase actual: direcciones en artboard, sin tocar código.

## Specs

- **S1 (usuario, verbatim):** «no se si llegaste a identificar que es la card que dice "Detalles de la
  Cita" preguntame de nuevo» — el objetivo es el `p-dialog` con `header="Detalles de la Cita"` del
  calendario (500 px, filas `label`/`valor`), **no** el diálogo grande de pestañas
  (`booking-detail-dialog`).
- **S2 (usuario, verbatim — reemplaza la opción anterior de alcance):** «puedes remover lo del
  dialogo grande de reserva del diseño, no queremos modificar eso ahora» — alcance final: sólo
  `admin/calendar` (`full-calendar.component`) y `provider/calendar` (`provider-calendar.component`,
  hoy un clon más pobre con «Cliente:», «RUT:» y footer Cerrar/Editar), con el mismo shell en los
  dos. `booking-detail-dialog` **queda fuera de alcance**: no se modifica.
- **S3 (usuario, opción elegida, verbatim):** «Estructura e jerarquía de la información» — el
  problema a resolver no es solo piel: hoy 10 filas planas `label`/`value` mezclan identidad
  (cliente, RUT, teléfono), logística (servicio, profesional, ubicación, fecha), dinero (precio) y
  estado (chip), con el dato más operativo —cuándo— en séptimo lugar y el estado de pago solo
  visible a través de los botones del footer.
- **S4 (usuario, opción elegida, verbatim):** «Primero artboards en design/ y elegís» — se entregan
  direcciones en artboard y el usuario elige una antes de escribir código.
- **S5 (usuario, verbatim):** «en una rama aparte y volvemos luego saliendo de develop» — rama
  aparte desde `develop`; el trabajo en curso de `feat/billing-wizard-steps` no se arrastra.

## Restricciones del proyecto

- Solo tokens de `src/styles/_tokens.scss` (vía `design/system.md`); nada de colores nuevos. Tres
  temas conviven (claro, `body.dark-theme`, `body.theme-kinesilk`): todo color nuevo sería un token
  con override en los tres bloques.
- Chips de estado/pago con `.bw-chip` y sus variantes: no se inventa paleta de estado.
- El footer del diálogo mantiene la lógica de acciones actual (Abonar solo con pago pendiente o
  parcial; Ver pago con parcial o pagado; Editar siempre).
- `booking-detail-dialog` no se toca (S2): conserva sus 6 pestañas, su keep-alive y sus `::ng-deep`.

## Tasks

| # | Tarea | Specs | Ruta | Commit |
|---|---|---|---|---|
| T1 | Tres direcciones estructurales del diálogo en `design/detalle-cita/` + `design.json` | S1-S4 | inline (diseño) | ✅ (dirección 01 elegida) |
| T2 | Implementar la dirección 01 en `full-calendar.component` (admin) | S1-S4 | inline | ✅ |
| T3 | Replicar el mismo shell en `provider-calendar.component` | S2 | inline | ✅ |
| T4 | ~~Alinear `booking-detail-dialog` a la familia elegida~~ — **descartada** (S2: no se modifica) | — | — | — |
| T5 | Verificación: build + suite de tests | S1-S5 | inline | ✅ build + 48 specs del calendario |

Pendiente heredado de T3: `provider-calendar.component` no tenía spec propia antes de este cambio y
sigue sin ella; su plantilla queda cubierta por el build, no por un test de comportamiento.

## Log

- **L1 (usuario, verbatim):** «en una rama aparte y volvemos luego saliendo de develop, podemos
  re-diseñar la tarjeta de detalles dela cita el dialogo me refiero para ir mas a la par de los
  estilos de bookwise?»
- **L2 (usuario, verbatim):** «no se si llegaste a identificar que es la card que dice "Detalles de la
  Cita" preguntame de nuevo» — corrige el objetivo: el diálogo del calendario, no el de pestañas.
- **L3 (usuario, decisiones):** WIP → «Commit WIP en la rama actual y después rama desde develop»
  (commit `3dd4d33` en `feat/billing-wizard-steps`); alcance → «Los dos calendarios y el diálogo
  grande de reserva»; foco → «Estructura e jerarquía de la información»; entrega → «Primero
  artboards en design/ y elegís».
- **L4 (agente):** rama `feat/booking-detail-card-redesign` creada desde `origin/develop` (`beeb907`).
  Hallazgo: `booking-detail-dialog` es el peor deudor de `::ng-deep` del repo (16 usos, según
  `odd/tasks/ui-standardization.md`), y el diálogo del calendario no usa ninguna primitiva global —
  por eso se ve «de otra app».
- **L5 (agente):** `design/detalle-cita/` escrito con 3 direcciones y `design.json`:
  `01-identidad-bloques.html` (identidad + bloques), `02-hora-protagonista.html` (la hora manda),
  `03-recibo-lineal.html` (recibo con banda de estado); las otras dos son alternativas hasta que se
  elija. Canvas: `http://127.0.0.1:44971/OjmEPypMgk8a94LcuIvG1I1J7EKgAzIb/d/detalle-cita/`.
  Aviso de `staleSources` en `design/system.md`: es por fecha de archivo; `git diff` de
  `src/styles/_tokens.scss` y `src/styles.scss` contra el commit que escribió el system md (`b89a521`)
  está vacío, así que los tokens son los vigentes.
- **L6 (usuario, verbatim):** «puedes remover lo del dialogo grande de reserva del diseño, no queremos
  modificar eso ahora.» — se saca el diálogo grande de las tres direcciones: cada artboard muestra
  ahora el diálogo del calendario admin y la variante del profesional dentro del mismo escenario. S2
  reescrita y T4 descartada.
- **L7 (usuario, comentarios del canvas):** «si necesito que diga hablar por whatsapp, es mas
  evidente» + «el telefono es importante por eso queremos conservar el boton de hablar por whatsapp
  donde aparezca el telefono, con el icono de whatsapp incluido» + «que sea el icono real de
  whatsapp, tenemos icons en el proyecto». Aplicado en las tres direcciones: el teléfono nunca va
  solo, siempre con el botón etiquetado «Hablar por WhatsApp» y el glifo real de la marca (el mismo
  de `pi-whatsapp`, inlineado en el artboard). En la app: `<p-button icon="pi pi-whatsapp"
  label="Hablar por WhatsApp" severity="success" [outlined]="true" size="small">`.
- **L8 (usuario, comentario del canvas):** «podrias integrar esa barra superior que veo que usaste el
  color del estado, en los otros dos diseños?» — la banda de 3 px con el color del estado pasa a ser
  mobiliario común de las tres direcciones (y de la variante del profesional, que la hereda). El color
  sale de `bookingStatusChipClass()`, el mismo token del chip.
- **L9 (usuario, comentario del canvas):** «añade el correo del cliente». En 02 el correo entra en el
  bloque del paciente como tercer canal de contacto (RUT · teléfono + botón WhatsApp · email), con
  `mailto:` y el azul de enlace `--bw-tab-color`. Sólo 02: 01 y 03 quedan sin correo hasta que se
  pida.
- **L10 (usuario, comentario del canvas):** «por pagar». El chip de pago de 02 pasa de «Saldo $18.000»
  a «Por pagar $18.000»: nombra la acción pendiente, no el remanente contable. En 01 el chip dice
  «Pago parcial» y en 03 la cifra se rotula «Saldo pendiente»; si se elige 02, el vocabulario de los
  tres estados queda: «Pagado», «Pago parcial», «Por pagar $».
- **L11 (usuario, comentario del canvas):** «pendiente pago» — segunda iteración sobre el mismo chip de
  02: queda «Pago pendiente $18.000». Vocabulario de estados de pago para la dirección 02:
  «Pagado» / «Pago parcial» / «Pago pendiente $».
- **L12 (usuario, comentarios del canvas):** «precio sesion» + «recuerda que este boton tambien tiene
  su version que dice ver pago, cuando ya tiene algun pago registrado, osea es un boton adicional».
  El monto del bloque de pago se rotula «Precio sesión» (01 y 02) y el footer muestra el estado
  parcial con las cuatro acciones: Cerrar · Abonar · Ver pago · Editar. Matriz documentada en la
  anotación 5 de las tres direcciones: sin pago → Abonar; parcial → Abonar + Ver pago; pagado → Ver
  pago; Editar siempre.
- **L13 (handoff de diseño → implementación):** el usuario eligió el artboard
  `design/detalle-cita/01-identidad-bloques.html` («Identidad + bloques»). Implementado:
  - `src/styles/_booking-sheet.scss` (nuevo): shell `.bw-sheet` compartido — cabecera con avatar,
    identidad y canales de contacto; bloques de sesión, pago y notas; footer de acciones. Sin
    `::ng-deep`, sólo tokens.
  - `src/styles.scss`: importa la parcial.
  - `src/app/core/utils/booking-sheet.util.ts` (nuevo) + spec: `formatSpanishLongDate`
    («viernes 14 de noviembre»), `personInitials` («CR») y `whatsappHref` (sólo dígitos para `wa.me`).
  - `booking-statuses.ts` + spec: `bookingStatusChipTextClass()` — el acento del estado no es legible
    como texto sobre su propio tinte; el chip del diálogo ahora fija `--chip-color` y
    `--chip-text-color`, con contraste AA.
  - `full-calendar.component.{html,ts}`: el diálogo «Detalles de la Cita» pasa a la jerarquía
    identidad → sesión → pago → notas. Se conserva la lógica de acciones (Abonar si no está pagada;
    Ver pago si parcial o pagada; Editar siempre) y el enlace de WhatsApp ahora normaliza el teléfono
    completo.
  - `provider-calendar.component.{html,ts}`: mismo shell, sin bloque de pago con estado de cobro; el
    precio se mantiene visible como dato de la sesión (no se quitó información existente).
  - Verificación: `ng build` OK y 48 specs del calendario en verde (4 nuevas sobre la ficha), más los
    specs de la util y de las constantes.
  - Diferencia consciente con el artboard: el diálogo real conserva el botón × de PrimeNG y la
    `p-button` de WhatsApp mide 2.5 rem (alto global de control), no 2.125 rem.
- **L14 (commits del work unit):** `683f813` (design: 3 artboards + este documento, 1.799 líneas
  porque los artboards son HTML autocontenido) y `0e68151` (implementación: parcial `.bw-sheet`,
  utils, chips AA, los dos calendarios y sus specs). Van separados por tipo de artefacto, no por
  tamaño: la parcial, los templates y los componentes son interdependientes y no compilan por partes.
- **L15 (usuario, comentario del canvas):** «necesitamos que el agente de front mensajee al backend para
  que haga seeds donde existan agendas que hayan tomado packs o servicios que vienen con la variacion
  para poder consumir esta informacion en el front, es decir saber cual es la sesion actual». No es un
  cambio visual: el chip «Sesión 3 de 6» ya se alimenta de `booking.pack_session`. Se trasladó el
  pedido a la sesión de Bookwise-API con el detalle de lo que necesita el front: service_pack con
  variaciones, client_pack, reservas con `pack_session` poblado, mezcla de estados (attended /
  scheduled / pending) y de pago (partial / paid), dos clientes y notas. Preguntas abiertas: si
  `GET /bookings` devuelve `pack_session` en el listado, si hay endpoint para listar las sesiones de un
  `client_pack`, y si los seeds quedan versionados o son one-shot de local.
- **L16 (usuario, comentario del canvas):** «en este diseño el boton quedo el boton de whatsapp abajo,
  asegurate de que en la implementacion tambien quede abajo, porque en la implementacion lo que bajo
  fue el estado». Corregido en `.bw-sheet`: el nombre y el chip de estado comparten una fila propia
  (`__top`, con el nombre truncándose si hace falta y el chip sin encogerse) y el botón de WhatsApp
  pasa a `flex-basis: 100%`, así que siempre cae en su renglón, debajo de RUT y teléfono. En mobile
  (≤520 px) el chip sí puede bajar bajo el nombre.
- **L17 (usuario, comentario del canvas):** «la sesion, me parece poco profesional, prueba otra
  palabra u otra forma de escribirlo». El overline del bloque pasa de «La sesión» a **«Atención»** —
  el término que usa el rubro para la cita clínica, sin coloquialismos. Aplicado en el artboard 01
  (diálogo admin y variante del profesional) y en las dos plantillas reales para que diseño e
  implementación no se separen. Alternativas si no convence: «Fecha y hora», «Información de la cita»,
  «Horario».
- **L18 (usuario, comentario del canvas):** «esta sesion» sobre el overline «Atención» — el rótulo del
  bloque queda **«Esta sesión»**: señala el ítem que se está mirando, sin el artículo coloquial de «La
  sesión» y sin el tono administrativo de «Atención». Sincronizado en el artboard 01 y en las dos
  plantillas.
- **L19 (usuario):** «repara el header del dialogo de detalle de cita con el boton de whatsapp y el
  telefono abajo y arriba el nombre el rut y el badge de estado, y a los botones del footer devuelvele
  los iconos que tenia». Cabecera en dos filas: arriba nombre + chip de RUT + badge de estado (el nombre
  es lo único que se recorta), abajo teléfono + botón «Hablar por WhatsApp». Footer con los iconos
  originales: `pi pi-plus` (Abonar), `pi pi-dollar` (Ver pago), `pi pi-pencil` (Editar). Artboard 01
  sincronizado con la misma cabecera e iconos aproximados con SVG inline.
- **L20 (usuario, decisión):** «2 y commiteas el ajeno asi lo puedes integrar». El WIP de la otra
  sesión (perfil/tenant) se commitea tal cual en esta rama para no perderlo. **Aviso registrado**: ese
  estado no compila y revierte material de develop — `i18n/es.ts` pierde 555 claves, `auth.service.ts`
  pierde 6 APIs públicas (`hasPermission`, `hasAllPermissions`, `isAdminGeneral`,
  `syncTokenFromStorage`, `updateAccount`, `needsOnboarding`), `calendar-prefs.service.ts` pierde
  `getLastProviderId`/`setLastProviderId` y `app-header.component.ts` pierde `appearance`,
  `appearanceOptions` y `onAppearanceChange`. El commit `wip:` deja constancia; integrarlo exige
  restaurar antes esos archivos desde develop.
- **L21 (usuario, comentario del canvas con captura del diálogo real):** «esta todo un poco encima los
  elementos, podemos mejorarlo?». Ajustes de aire en la cabecera de `.bw-sheet`: cabecera alineada
  arriba (`align-items: flex-start`), separación explícita por filas (`row-gap: .25rem`), el botón de
  WhatsApp vuelve a su propia línea (`flex-basis: 100%`) y **deja de heredar el alto global de control**:
  dentro de la cabecera el `size="small"` mide 2.125rem, no 2.5rem, que era lo que aplastaba el bloque.
  El badge de estado pasa a la fila del nombre en el artboard y en la variante del profesional.
- **L22 (respuesta de Bookwise-API a L15):** los seeds de packs con sesiones están **listos y corridos
  en local**, en la rama/PR `feat/pack-sessions-seeder` (**Book-wise/Bookwise-API#93, todavía sin
  mergear**). Comando: `php artisan tenant:seed-pack-bookings 4` (Kinesilk Cordillera; aborta en
  producción, idempotente por paciente, `--sessions=` y `--discount=` opcionales).
  - Sembrado: `service_pack #2` «6 sesiones» sobre Kinesiología Deportiva ($229.500, -15%) y dos
    pacientes con pack del mismo servicio: **Valentina Silva** (cliente 1) y **Matías Ortega**
    (cliente 2).
  - Sesiones de Valentina: 1-2 `attended`, **3 `scheduled` → reserva #462 el 10/11 16:30** (la del
    chip «Sesión 3 de 6»), 4 `pending` con reserva el 18/11 11:00, 5-6 sin reserva. Matías: 3
    `scheduled` → reserva #466 el 13/11 16:30.
  - Cobros con `paid` / `partial` / `unpaid` y notas en `bookings.notes` (interna) y
    `pack_sessions.notes` (para el paciente).
  - **`pack_session` viene en el listado y en el detalle** de `/bookings` (con `session_number`,
    `total_sessions`, `client_pack_id`, `service_pack_id`, `effective_price`, `price`, `notes`,
    `status`), que es todo lo que consume el chip de este diálogo.
  - ⚠️ `pack_session.all_sessions` llega **`[]`** en listado y detalle. Para la lista completa de
    sesiones del paciente hay que usar **`GET /v1/clients/{id}/packs`** (por pack: `total_sessions`,
    `used_sessions`, `remaining_sessions`, `status` y `sessions[]` con `status`, `attended_at`,
    `price`, `notes` y `scheduled_at` ya resuelto).
- **L23 (respuesta de Bookwise-API a las dos preguntas de L22):**
  - `GET /v1/clients/{id}/packs` exige **`clients.view`** (no `client_packs.view`, que sólo gatea
    `/client-packs`), y además corre `ClientPolicy@view`: para un paciente que no es del profesional
    devuelve **403**, no lista vacía. `clients.view` ya está en la baseline de `staff`, así que el
    profesional puede leer los packs de sus pacientes. El front debe tratar ese **403 como «no
    aplica»**, no como error.
  - `scheduled_at` llega en **hora local con offset** (`2026-11-10T16:30:00-03:00`): no hay que
    convertir nada, alcanza con formatear el offset que ya viene. El offset sale de `app.timezone`
    (America/Santiago), no de una columna por sucursal: si entra un tenant en otra zona, revisar.
- **L24 (hallazgo del front a partir de L22, fuera del alcance de S2):** `payment-tab.component.ts`
  (`buildItems`) arma el desglose del recibo desde `booking.pack_session.all_sessions`; como ese array
  viene `[]`, hoy cae al fallback de **una sola línea** con el precio de la reserva en vez de las 6
  sesiones. No rompe, pero degrada el recibo de una venta de pack. Va como deuda para la feature de
  packs, no para este rediseño (el diálogo grande está fuera de alcance).
- **L25 (respuesta de Bookwise-API a L24):** era un hueco, no una decisión, y **lo arreglan en la API**
  (PR **#94**, `fix/booking-detail-pack-sessions`): `GET /bookings/{id}` ahora carga las sesiones del
  pack, así que `pack_session.all_sessions` viene completo (ordenado por `session_number`, con `status`,
  `price`, `effective_price`, `attended_at`, `booking_id` y `booking.start_time` con offset). **En el
  listado sigue `[]` a propósito** (payload del calendario; el chip sólo necesita `session_number` +
  `total_sessions`).
  - Consecuencia para el recibo: `payment-tab` **no** debe armarse desde un ítem del listado. Hoy
    consume `GET /sales/{id}` (`salesApi.getSale`), cuyo `booking` embebido es otro recurso — queda
    abierto si #94 lo cubre o si hay que pedir `GET /bookings/{id}` aparte.
  - `GET /bookings` responde **array plano**, no el envelope `{data, links, meta}`: el store ya lo
    tolera (`Array.isArray(raw) ? raw : raw.data ?? []`), así que no rompe, pero el tipo
    `PaginatedResponse<Booking>` del servicio no refleja la realidad.
  - Nada de esto toca el rediseño del diálogo: el chip usa sólo `session_number` y `total_sessions`.
    El arreglo del recibo queda como deuda de la feature de packs (S2 excluye el diálogo grande).
