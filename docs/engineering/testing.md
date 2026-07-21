# Testing

## Configuracion

`package.json` declara `npm test` como `ng test`. `tsconfig.spec.json` incluye `vitest/globals`, y `package.json` declara `vitest` y `jsdom` como dependencias de desarrollo.

## Specs presentes

Archivos encontrados:

- `src/app/app.spec.ts`
- `src/app/features/admin/bookings/booking-form-dialog/booking-form-dialog.component.spec.ts`
- `src/app/shared/components/patient-card/patient-card.component.spec.ts`
- `src/app/shared/utils/client-similarity.util.spec.ts`

## Cobertura funcional observada en specs

- Creacion basica del componente raiz.
- Utilidades de similitud de clientes: normalizacion, telefonos, email, nombre y deduplicacion.
- Formulario de reserva: alternancia de paneles, reset de paciente nuevo, validacion RUT, mensajes inline del panel de paciente y deteccion de pacientes similares.
- Patient card: iniciales, advertencia por contacto incompleto, enlace WhatsApp, tabs y carga lazy de ventas/reservas recientes.

## No ejecutado

No se ejecuto `npm test`. No se confirma resultado actual de la suite.

