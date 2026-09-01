# Apply Progress: dashboard-citas-pendientes

> Phase: apply — 4/4 work units complete.
> Mode: Standard (strict_tdd: false) — config.yaml.
> Date: 2026-09-01 · Artifact store: hybrid (OpenSpec + Engram).
> Branch base: develop (b11f028).

## Work Units & Evidence

| Unit | Scope | Focused test | Build | Status |
|---|---|---|---|---|
| 1 — Service statusIds | `calendar-navigation.service.{ts,spec.ts}` | `npx ng test --no-watch --include="**/calendar-navigation.service.spec.ts"` → 13 passed | `npx ng build` OK | ✅ |
| 2 — FullCalendar consume | `full-calendar.component.{ts,spec.ts}`, `providers-list.component.{ts,spec.ts}` | `--include="**/full-calendar.component.spec.ts"` → 9 passed; `--include="**/providers-list.component.spec.ts"` → 6 passed | `npx ng build` OK | ✅ |
| 3 — Dashboard pending card | `admin-dashboard.component.{ts,html,scss}` | (no focused spec — see note) | `npx ng build` OK | ✅ |
| 4 — Range selector | `admin-dashboard.component.{ts,html,scss}`, `i18n/es.ts`, `i18n/en.ts` | (no focused spec — see note) | `npx ng build` OK | ✅ |

### Combined focused test run

```
npx ng test --no-watch \
  --include="**/calendar-navigation.service.spec.ts" \
  --include="**/full-calendar.component.spec.ts" \
  --include="**/providers-list.component.spec.ts"
→ Test Files 3 passed (3) · Tests 28 passed (28)
```

## Work Unit Evidence (per sdd-apply Step 3)

| Evidence | Required value | Result |
|---|---|---|
| Focused test command and exact result | Smallest command proving the unit + counts | `npx ng test --no-watch --include="**/calendar-navigation.service.spec.ts"` → 13 passed; `--include="**/full-calendar.component.spec.ts"` → 9 passed; `--include="**/providers-list.component.spec.ts"` → 6 passed. Combined: 28/28. |
| Runtime harness command/scenario and exact result | Real integration/runtime path | `npx ng build` → application bundle generation complete (0 errors). Pre-existing warnings: bundle initial > 500 kB budget; luxon CommonJS (both already present before this change). |
| Rollback boundary | Exact files/behavior that can be reverted without removing unrelated work | Revert `src/app/core/services/calendar-navigation.service.ts` + `full-calendar.component.ts` (Units 1-2) independently of `admin-dashboard.component.{ts,html,scss}` + `i18n/{es,en}.ts` (Units 3-4). No cross-dependency between the two feature sets. |

## Decisions & Notes

1. **Firma `navigateToCalendar(locationId, providerId, statusIds, router)`**: se siguió el orden del proposal (statusIds 3º, router 4º). Se actualizaron todos los callers existentes (`providers-list.goToAgenda` → `(location.id, provider.id, [], router)`) y los specs.
2. **`consumePending()` ahora devuelve `{ locationId, providerId, statusIds }`**: todos los `toEqual` de specs existentes que no incluían `statusIds` se actualizaron.
3. **FullCalendar `loadLocations`**: se agrega la aplicación de `selectedStatusIds` (status-only nav) sin romper la rama de location/provider pending. En la rama pending-location sin provider pero con status, se sincroniza `onFilterChange()` una vez.
4. **Stubs de browser APIs en `full-calendar.component.spec.ts`**: la suite estaba pre-existente-rota por `window.matchMedia is not a function` (verificado: base b11f028 también falla 8/8 con el mismo error). Se agregó un `beforeAll` con stubs de `matchMedia`/`ResizeObserver`/`IntersectionObserver` (contenido en el spec) para hacerla runnable y probar el nuevo test de navegación por estado. No se tocó infraestructura global de tests.
5. **Dashboard spec**: NO se agregó. El dashboard importa `p-chart` + `ChartDataLabels` (canvas/Chart.js), que no renderiza en jsdom sin mocks invasivos de canvas — riesgo de flakiness desproporcionado para el valor. El flujo de navegación por estado se cubre a nivel service + full-calendar (integración real service+store).
6. **`is_finalized` en `BookingStatus` (front)**: NO se agregó (contrato backend pendiente, follow-up coordinado; el filtro inicial usa `status_id=5`). Documentado en tasks.md.

## Files Changed

| File | Action | What Was Done |
|---|---|---|
| `src/app/core/services/calendar-navigation.service.ts` | Modified | Added `pendingStatusIds`, new `navigateToCalendar(locationId, providerId, statusIds, router)`, `consumePending` returns `statusIds`; clears statusIds on rejection |
| `src/app/core/services/calendar-navigation.service.spec.ts` | Rewritten | 13 tests incl. status-only navigation |
| `src/app/features/admin/calendar/full-calendar.component.ts` | Modified | `loadLocations` applies pending `statusIds` to `selectedStatusIds` + syncs filters |
| `src/app/features/admin/calendar/full-calendar.component.spec.ts` | Modified | Signature updates, browser-API stubs, status-only nav test (9 passed) |
| `src/app/features/admin/providers/providers-list.component.ts` | Modified | Caller updated to new signature (`[]` statusIds) |
| `src/app/features/admin/providers/providers-list.component.spec.ts` | Modified | Expectation updated to `(5, 1, [], mockRouter)` |
| `src/app/features/admin/dashboard/admin-dashboard.component.ts` | Modified | Range selector state + computeds + rxResource recalculation + clickable pending card |
| `src/app/features/admin/dashboard/admin-dashboard.component.html` | Modified | Range selector UI + pending card (clickable, badge) |
| `src/app/features/admin/dashboard/admin-dashboard.component.scss` | Modified | Range selector + clickable card + badge styles |
| `src/app/core/i18n/es.ts` | Modified | Added dashboard range/pending keys (ES) |
| `src/app/core/i18n/en.ts` | Modified | Added dashboard range/pending keys (EN) |

## Deviations from Design

None — implementation follows the proposal approach. The only adaptation: `navigateToCalendar` is invoked as `(null, null, [5], router)` from the dashboard for the status-only card (as specified), and all existing callers were updated to the new signature.

## Issues Found

- Pre-existing: `full-calendar.component.spec.ts` was broken in jsdom by missing `window.matchMedia` (base also fails 8/8). Fixed within the spec with scoped stubs.
- Pre-existing build warnings (bundle budget, luxon CommonJS) — not introduced by this change.
