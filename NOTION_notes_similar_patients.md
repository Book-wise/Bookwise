Resumen de regresiones y consideraciones — Similar Patients (16 Jun 2026)

**Qué pasó (What):**
- Se introdujo una implementación de "similar patients" que añadió utilidades, lógica RxJS y cambios en `BookingFormDialogComponent` el 16 Jun 2026.
- La integración directa en el componente mezcló señales, `ngModel` (template-driven forms), Subjects y lógica de UI, lo que provocó estados inconsistentes y tests rotos.

**Por qué fue un problema (Why):**
- Mezcla de paradigmas reactivos (signals/Subjects) con formularios template-driven provoca expectativas de reactividad distintas y estados colgados.
- Lógica pesada en el componente dificulta el razonamiento local y provoca side-effects en flujos de cierre/abrir.
- Se añadieron tests y cambios en UI que desincronizaron expectativas (test del `App` que esperaba un `h1`).

**Dónde tocar (Where):**
- `src/app/features/admin/bookings/booking-form-dialog/booking-form-dialog.component.ts` — responsable de la mayor parte de la complejidad añadida.
- `src/app/features/admin/bookings/similar-patients.service.ts` — nueva extracción 
- `src/app/shared/utils/client-similarity.util.ts` — utilidades puras añadidas
- `src/app/app.spec.ts` — test obsoleto actualizado

**Lecciones aprendidas / Aprendizajes (Learned):**
- Mantener la lógica de negocio fuera de componentes UI: extraer a servicios que devuelvan Observables/futures.
- Evitar mezclar señales y `ngModel` en la misma responsabilidad; migrar a Reactive Forms o mantener template-driven puro.
- Añadir pruebas unitarias al servicio de precheck antes de integrarlo en el componente.
- Añadir un guard de seguridad en la pipeline (PR review automática y checklist) para evitar merges directos de cambios grandes sin reviewers humanos.

**Acciones recomendadas (next steps):**
1. Revisar la rama `rework/similar-patients-service` y validar el servicio aislado con tests unitarios.
2. Revisar el `BookingFormDialog` para que delegue (no implemente) la resolución/UX del picker; el componente sólo orquesta.
3. Considerar migración a Reactive Forms para la creación de pacientes (mayor control y testabilidad).
4. Añadir un PR-template que obligue a pasar la suite y añadir un revisor humano ("gentle-guardian-angel").

---
Notas generadas automáticamente por el asistente el 2026-06-16. Copiar y pegar en la página de Notion correspondiente.