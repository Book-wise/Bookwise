# Archive Report — api-service-separation

> Change: `api-service-separation`. Archive date: `2026-09-02`. Final state: **PASS**.
> Store: `openspec`. This report reflects the state of the change AT CLOSE, per the Final-State Authority hierarchy. It does not echo intermediate `apply-progress`/`verify-report` claims as current facts.

## Final State

**Verdict: PASS.** Build exit 0; API-layer suite 63/63 tests pass (11 spec files); 0 references to the monolithic `ApiService`; `src/app/core/services/api.service.ts` deleted; barrel alias removed. Tasks reconciled to **37/37** (all `[x]`, 0 unchecked). No blockers, no CRITICAL issues.

## What Was Implemented

The monolithic `ApiService` was replaced by domain-specific services under `src/app/core/services/api/`:

- 8 domain services (`providedIn: 'root'`, standalone, mechanical method extraction — no behavior/signature changes):
  - `auth-api.service.ts` — `login`, `register`
  - `bookings-api.service.ts` — bookings + available slots (6 methods, NO sales)
  - `sales-api.service.ts` — sales + transactions (7 methods; separate bounded context per design decision)
  - `clients-api.service.ts` — clients + client-packs (7 methods)
  - `locations-api.service.ts` — locations + regions + comunas (7 methods)
  - `providers-api.service.ts` — providers CRUD (4 methods)
  - `services-api.service.ts` — services + packs (5 methods)
  - `blocked-slots-api.service.ts` — blocked slots CRUD + group delete (5 methods)
- `build-http-params.ts` — pure `buildHttpParams(obj: Record<string, any>): HttpParams` helper (shared, tree-shakeable).
- All 22 consumers migrated (4 stores + 18 components):
  - Stores: `reference.store.ts`, `booking.store.ts`, `historial.store.ts`, `client-detail.store.ts`.
  - Components/sub-services: login, register, full-calendar, admin-dashboard, clients-list, booking-dialog (consolidated into `booking-dialog.store.ts`), booking-form-dialog, block-time-dialog, payment-detail-dialog (consolidated into `payment-tab.component.ts`), similar-patients, payment-tab, reserva-tab, historial-pagos, provider-calendar, provider-availability (import removed — unused), locations-list, location-dialog, providers-list, provider-dialog, packs-list.
- Monolith deleted: `src/app/core/services/api.service.ts` removed; no `@deprecated` re-export or barrel alias left.
- `@deprecated` JSDoc was added mid-migration then the file was deleted at cleanup.

Note: `businesses-api.service.ts` and `roles-api.service.ts` also live under `src/app/core/services/api/`, but those were added by the separate `onboarding-roles-profile` change, not by this change.

## Specs Synced → Canonical

The delta spec domain `api-service` did NOT previously exist in `openspec/specs/`. Per the sdd-archive Mechanical Copy Contract, it was copied verbatim (shell `cp` → `mv`, byte-identity verified by `diff -r` EMPTY). The promoted `openspec/specs/api-service/spec.md` is byte-identical to the change's delta spec.

| Domain | Action | Notes |
|--------|--------|-------|
| api-service | Created | Full-spec mechanical copy; contains 4 ADDED requirements + 1 REMOVED requirement (the monolith removal requirement). No pre-existing main spec. |

`diff -r` result between source (`openspec/changes/api-service-separation/specs/api-service/spec.md`) and promoted destination (`openspec/specs/api-service/spec.md`): **empty (no differences)** — the only passing evidence.

Because it is a brand-new domain with no pre-existing main spec, the promoted main spec retains the delta's `## ADDED Requirements` / `## REMOVED Requirements` framing verbatim rather than a normalized `## Requirements`; this matches the sdd-archive "delta spec IS a full spec when no main spec exists" rule and is byte-identical to the source.

## Task Completion

`tasks.md` (now `openspec/changes/archive/2026-09-02-api-service-separation/tasks.md`): **37/37 tasks** marked `[x]`, **0 unchecked** implementation tasks → Task Completion Gate passed.

There is **no `apply-progress.md`** for this change. Apply was tracked through isolated per-consumer git commits in the feature branch, not through an apply-progress artifact. This report does not fabricate one; apply completion is evidenced by tasks `[x]` reconciliation plus the final tree state.

## Verification Evidence (final)

- **Build**: `npx ng build` → **exit 0** ("Application bundle generation complete"). Pre-existing warnings only: bundle initial budget 500 kB exceeded by 322.13 kB (822.13 kB total, within the 1 MB `maximumError`), and a `luxon` CommonJS/AMD bailout. Neither affects the exit code.
- **API-layer tests**: `npx ng test --no-watch --include='src/app/core/services/api/*.spec.ts'` → **11 test files, 63 passed / 0 failed** (exit 0), duration 2.36s.
- **Monolith removal**: `grep -rn "ApiService" src/` → **0 matches** in source. `src/app/core/services/api.service.ts` does not exist.
- **Barrel alias**: no re-export of the monolith remains; removed with `api.service.ts`.

## Recorded Test Fix (working tree, uncommitted)

The verify phase found a matcher bug in `src/app/core/services/api/clients-api.service.spec.ts` (2 failing tests): the `getClientPacks()` request carried `?client_id=1` but the assertion matched on an exact URL string `expectOne('${baseUrl}/client-packs')`. Fixed by changing **line 114** to the predicate form:

```ts
const req = httpMock.expectOne((r) => r.url === `${baseUrl}/client-packs`);
```

This fix is in the **working tree, uncommitted** (not yet committed). It is recorded here as part of this change. With it applied, the API-layer suite passes 63/63. The fix itself is NOT part of the archive — the archive only contains spec/design/tasks; the fix lives in `src/app/core/services/api/clients-api.service.spec.ts`, which is outside `openspec/changes/`.

## Archive Move

Change folder moved from `openspec/changes/api-service-separation` → `openspec/changes/archive/2026-09-02-api-service-separation` via `git mv`. Pre-move recursive snapshot vs. post-move tree: `diff -r` **empty (no differences)**. Source directory no longer present. Active changes directory still has other changes (`patient-card-rf-panels`, `state-management-analysis`, `state-management-refactor`) — none touched by this archive.

## Open Questions / Follow-ups

1. **Naming drift — Sales vs Bookings.** The spec's consumer table and tasks name several sales-related consumers as injecting `BookingsApiService` (e.g. T-25 `payment-tab.component.ts`, T-27 `historial-pagos.component.ts`, and the spec's "BookingsApiService (sales)" row). The implementation instead created a **separate `SalesApiService`** (per the design's "SalesApiService vs within BookingsApiService" decision) and uses it in: `historial-pagos.component.ts`, `payment-tab.component.ts`, `historial.store.ts`, `client-detail.store.ts`. This is spec→impl naming drift, not a defect; the design document already records the deliberate decision to separate Sales. A follow-up could align the spec's consumer table to the actual `SalesApiService` references.
2. **Spec framing.** The promoted `api-service` spec keeps `## ADDED Requirements` / `## REMOVED Requirements` delta headers (byte-identical to source) rather than a normalized `## Requirements` structure used by other promoted domains. Optional cosmetic normalization, not required.
3. **`booking-dialog` / `payment-detail-dialog` consolidation.** Tasks T-20 and T-23 note these components were consolidated into `booking-dialog.store.ts` and `payment-tab.component.ts` respectively; the component files no longer carry the migration directly. Confirmed in the tree.
