# Preguntas Abiertas Y Zonas No Verificadas

## API y backend

- No se verifico la API Laravel real. Los endpoints documentados son los consumidos por el frontend.
- No se confirmaron reglas backend de autorizacion, validacion, colisiones de horario, pagos o sesiones de packs.
- No hay esquema de base de datos ni migraciones backend en este repositorio.

## Disponibilidad de provider

- `AvailabilityService` mantiene disponibilidad de provider en mock local y tiene comentarios TODO para endpoints reales. La pantalla `/provider/availability` existe, pero la persistencia real no esta confirmada por este frontend.

## Cliente final

- El README menciona que clientes pueden crear sus propias reservas con perfil. En las rutas actuales solo hay login, register, admin y provider. No se encontro una ruta especifica de cliente final.

## Tabs placeholder

- En `PaymentDetailDialogComponent`, los tabs de recordatorios, ficha medica e historial muestran contenido vacio/proximamente. No se encontro implementacion funcional para esas areas.

## Dashboard

- El dashboard carga datos reales para sedes, providers y bookings, pero los graficos inicializados en `initCharts()` usan datos fijos locales. No se verifico si son placeholders intencionales o temporales.

## AGENTS.md

- El pedido incluyo agregar una regla persistente en `AGENTS.md`, pero tambien indico no modificar nada fuera de `/docs`. En la revision no se encontro `AGENTS.md` en la raiz. Crear ese archivo seria una modificacion fuera de `/docs`, por lo que queda pendiente de confirmacion explicita.

## Verificacion no ejecutada

- No se ejecuto build.
- No se ejecuto test.
- No se levanto servidor local.

