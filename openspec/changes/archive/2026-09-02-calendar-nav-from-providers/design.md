# Design: Calendar Navigation from Providers

## Technical Approach

Transactional signal-based filter pre-selection between two admin components (providers list → calendar). A new `CalendarNavigationService` holds transient pending-location and pending-provider signals. The providers list writes them before navigating; the calendar reads and clears them transactionally on successful location load. No URL params, no persistence — one-shot, consumed on arrival.

## Architecture Decisions

### Decision: Signal-based service over URL query params

| Option | Tradeoff | Decision |
|--------|----------|----------|
| URL query params (`/admin/calendar?location=1&provider=5`) | Survives refresh, but adds parsing complexity, routing guard changes, and encoding edge cases | Rejected — overengineered for same-tab navigation |
| **Signal-based service** | Simple, zero routing changes, consumed transactionally | **Chosen** — matches the proposal's "no persistence" constraint |
| Router state via `NavigationExtras.state` | Survives soft navigation but lost on refresh; couples filters to routing infra | Rejected — signals are simpler and testable without Router mocking |

### Decision: Consume pending filters on `loadLocations` success, not `ngOnInit`

Pending filters need locations data loaded first (location dropdown population). Consuming them before `loadLocations` completes would cause a race — the location filter value would be set but no matching location option exists yet. Consuming in the success callback of the locations API call guarantees the location exists and the providers re-fetch will pick up the pending provider ID.

### Decision: No `console.log` for debugging

The welcome toast (`MessageService.add`) is the only user-facing signal of successful navigation. No development-only logging — if visibility is needed later, add it via a structured logging service.

## Data Flow

```
ProvidersListComponent                          FullCalendarComponent
    │                                                   │
    │  goToAgenda(provider)                              │
    │  ├─ CalendarNavigationService:                     │
    │  │   pendingLocationId = provider.location.id       │
    │  │   pendingProviderId = provider.id                │
    │  └─ router.navigate(['/admin', 'calendar'])         │
    │                                                   │
    │                                                   │  ngOnInit
    │                                                   │  └─ loadLocations()
    │                                                   │       ├─ API success
    │                                                   │       │   ├─ Check hasPendingNavigation()
    │                                                   │       │   ├─ YES → use pending location
    │                                                   │       │   │         → loadProviders(pendingLocationId)
    │                                                   │       │   │         → in callback: select provider
    │                                                   │       │   │         → clear pending (both to null)
    │                                                   │       │   │         → onFilterChange()
    │                                                   │       │   │         → show welcome toast
    │                                                   │       │   └─ NO  → default (first location)
    │                                                   │       └─ onFilterChange() → BookingStore
    │                                                   │                         → refetchEvents()
    │                                                   │                         → calendar re-renders
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/core/services/calendar-navigation.service.ts` | Create | Signal-based pending filter holder with `navigateToCalendar()` |
| `src/app/features/admin/providers/providers-list.component.ts` | Modify | Inject Router + CalendarNavigationService, add `goToAgenda()` |
| `src/app/features/admin/providers/providers-list.component.html` | Modify | Wire `(onClick)` on both agenda buttons, `[disabled]` + `pTooltip` |
| `src/app/features/admin/calendar/full-calendar.component.ts` | Modify | Inject service, read pending filters in `loadLocations()`, show toast |

## Interfaces / Contracts

```typescript
// src/app/core/services/calendar-navigation.service.ts
@Injectable({ providedIn: 'root' })
export class CalendarNavigationService {
  private pendingLocationId = signal<number | null>(null);
  private pendingProviderId = signal<number | null>(null);

  /** True if any pending navigation filter is set */
  readonly hasPendingNavigation = computed(() =>
    this.pendingLocationId() !== null || this.pendingProviderId() !== null,
  );

  /** Set pending filters and navigate. Clears after transactional read. */
  navigateToCalendar(locationId: number, providerId: number, router: Router): void {
    this.pendingLocationId.set(locationId);
    this.pendingProviderId.set(providerId);
    router.navigate(['/admin', 'calendar']);
  }

  /** Transactional read-and-clear: returns pending state or nulls */
  consumePending(): { locationId: number | null; providerId: number | null } {
    const result = {
      locationId: this.pendingLocationId(),
      providerId: this.pendingProviderId(),
    };
    this.pendingLocationId.set(null);
    this.pendingProviderId.set(null);
    return result;
  }
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | CalendarNavigationService | Verify `navigateToCalendar` sets signals + calls router.navigate; `consumePending` returns and clears; `hasPendingNavigation` reflects state |
| Unit | ProvidersListComponent | `goToAgenda()` calls service with correct IDs; button disabled when no location; tooltip text |
| Integration | FullCalendarComponent | `loadLocations()` consumes pending and pre-selects; toast shown; no pending on refresh (page reload) |
| E2E | Full flow | Click agenda → calendar loads with correct filters + toast |

## Migration / Rollout

No migration required. This is additive — new service, no existing behavior changes. The providers list currently has pi-calendar buttons without handlers; wiring them is purely additive.

## Open Questions

- None. All decisions are covered by the proposal and spec constraints.
