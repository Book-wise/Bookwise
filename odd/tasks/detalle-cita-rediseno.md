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
