# Handoff — saneamiento de la suite frontend

> Responsable de resolución: Sebacirk u otro agente con permiso para modificar código.
> Este documento registra evidencia; no autoriza cambios en tests ni producto.

## Estado reproducido

Comando ejecutado el 2026-09-11:

```bash
npm test -- --no-watch
```

Resultado:

- 42 archivos de pruebas: 38 correctos, 4 fallidos.
- 493 tests: 455 correctos, 38 fallidos.
- Duración observada: 61,58 s.
- El build previo a la ejecución de Vitest terminó correctamente.

Los 38 fallos se agrupan en cuatro causas. No deben tratarse como 38 defectos de producto.

## Grupo 1 — FullCalendar no puede crearse

- Archivo: `src/app/features/admin/calendar/full-calendar.component.spec.ts`
- Casos afectados: 32.
- Error raíz: `NG0201: No provider found for ActivatedRoute`.
- Evidencia: `FullCalendarComponent` inyecta actualmente `ActivatedRoute`, pero el `TestBed` del spec no
  registra un proveedor para esa dependencia.
- Lectura: fallo de bootstrap del fixture. Ninguno de los 32 casos alcanza sus aserciones funcionales.
- Trabajo esperado: agregar un stub mínimo y tipado de `ActivatedRoute`, con el contrato que realmente
  consume el componente, y volver a ejecutar el archivo completo.
- Precaución: no declarar los 32 comportamientos como correctos hasta que el componente pueda instanciarse;
  al corregir el setup podrían aparecer fallos funcionales adicionales.

## Grupo 2 — mock de HistorialStore desactualizado

- Archivo: `src/app/features/admin/bookings/booking-detail-dialog/tabs/historial/historial-reserva.component.spec.ts`
- Casos afectados: 3.
- Error raíz: `TypeError: ctx.bookingsShowingCount is not a function`.
- El componente consume hoy `loadingBookingsPage`, `paginatedBookings`, `bookingsPagination` y
  `bookingsShowingCount`; el mock del spec todavía expone únicamente `loading` y `bookings`.
- Trabajo esperado: alinear el doble con el contrato público vigente de `HistorialStore`.
- Decisión funcional pendiente: el spec espera clases como `bw-chip--warning`, pero la plantilla actual usa
  la clase base `bw-chip` y la variable CSS `--chip-color`. Sebacirk debe confirmar qué contrato visual es
  intencional antes de cambiar la expectativa o la implementación.

## Grupo 3 — matchMedia ausente en JSDOM

- Archivo: `src/app/features/admin/bookings/booking-form-dialog/booking-form-dialog.component.spec.ts`
- Casos afectados: 2.
- Error raíz: `TypeError: window.matchMedia is not a function`.
- El fallo aparece al instanciar `PatientCardComponent` desde el formulario.
- Otros specs del repositorio ya contienen dobles locales para `window.matchMedia`.
- Trabajo esperado: establecer un polyfill de pruebas compartido o incorporar el doble al setup del spec.
  Si se centraliza, eliminar duplicación solo cuando la suite completa confirme compatibilidad.

## Grupo 4 — expectativa de Router desalineada

- Archivo: `src/app/core/services/calendar-navigation.service.spec.ts`
- Casos afectados: 1.
- Esperado por el test: `router.navigate(['/admin', 'calendar'])`.
- Llamada actual: `router.navigate(['/admin', 'calendar'], { queryParams: undefined })`.
- Lectura: no hay evidencia de navegación rota; es una diferencia observable de firma.
- Decisión sugerida: cuando no exista fecha, no pasar opciones vacías; cuando exista, verificar
  explícitamente `queryParams.date`. La decisión final pertenece al responsable del código.

## Criterios de aceptación del saneamiento

1. Ejecutar individualmente los cuatro archivos afectados y obtener resultado verde.
2. Ejecutar `npm test -- --no-watch` y obtener 493/493 o el total actualizado sin fallos.
3. Ejecutar `npm run build -- --configuration production`.
4. Confirmar que el bundle productivo no contiene `127.0.0.1:9999`.
5. No debilitar aserciones funcionales para conseguir verde; actualizar únicamente contratos obsoletos y
   agregar cobertura cuando una modificación de producto lo requiera.
6. Registrar en el PR si cada corrección correspondió a entorno de prueba, test obsoleto o defecto real.

## Relación con CI/CD

- Mientras la suite siga roja, CI debe informar el resultado pero no puede convertirse responsablemente en
  un check obligatorio de despliegue.
- El deploy QA inicial no debe automatizarse desde `push` con tests ignorados.
- Gate recomendado: primero suite verde en una rama/PR; después marcar tests y build como checks requeridos;
  finalmente habilitar despliegue manual a QA.
