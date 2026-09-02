# Proposal: ApiService Separation

## Intent

Separate the monolithic `ApiService` (~364 lines, 30+ methods) into 7 domain-specific services to comply with Interface Segregation and Single Responsibility Principles. The current service violates ISP by forcing consumers to depend on methods they never use.

## Scope

### In Scope
- Create 7 standalone domain API services under `src/app/core/services/api/`
- Add a shared `buildHttpParams` utility
- Migrate all 22 consumers (4 stores + 18 components) to domain services
- Delete `ApiService` after last consumer is migrated

### Out of Scope
- Behavioral changes to API calls
- Error handling improvements
- New endpoints or features
- Base class extraction
- Store separation (separate change)

## Capabilities

Pure refactor — no spec-level behavior changes.

### New Capabilities
None

### Modified Capabilities
None

## Approach

Mechanical refactor following BAT (Bulk ApiService Termination). Phase 1: create 7 domain services + utility. Phase 2: migrate 4 stores. Phase 3: migrate 18 components. Phase 4: delete ApiService. Each consumer migration is an isolated, revertible commit.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/core/services/api.service.ts` | Deleted | Replaced by domain services |
| `src/app/core/services/api/` | New | 7 services + build-http-params.ts |
| `src/app/core/stores/` | Modified | 4 stores swap import |
| `src/app/features/` | Modified | 18 components swap import |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Missed consumer during migration | Low | `grep -r 'ApiService'` before final cleanup |
| Broken spec during migration | Low | Migrate provide token in same commit as consumer |

## Rollback Plan

Each consumer migration is one isolated commit. Revert that single commit if something breaks.

## Dependencies

None — pure refactor of existing code.

## Success Criteria

- [ ] `ng build` passes with zero compilation errors
- [ ] All existing tests pass
- [ ] No consumer imports `ApiService` directly
- [ ] `api.service.ts` is deleted
