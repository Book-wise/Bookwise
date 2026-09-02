# Calendar Navigation Specification

## Purpose

Cross-component navigation from the providers list to the calendar with transactional filter pre-selection. Allows users to click a "Ver Agenda" button on a provider row and land on `/admin/calendar` with that provider and its location pre-selected, without the selection persisting across page refreshes.

## Requirements

### Requirement: Agenda Button

Each provider row MUST display a "Ver Agenda" button (pi pi-calendar icon). Clicking it MUST navigate to `/admin/calendar` in the current tab.

#### Scenario: Button rendered on each provider

- GIVEN the providers list displays one or more providers
- WHEN each provider row is rendered (desktop table or mobile card)
- THEN it MUST include a "Ver Agenda" button with `pi pi-calendar` icon

#### Scenario: Same-tab navigation

- GIVEN a provider with a valid location
- WHEN the user clicks "Ver Agenda"
- THEN the browser navigates to `/admin/calendar` in the same tab

### Requirement: Button Disabled Without Location

If `provider.location` is null, the "Ver Agenda" button MUST be disabled. A tooltip MUST read "Sin sucursal asignada".

#### Scenario: No location disables button

- GIVEN a provider whose `location` is null
- WHEN the row renders
- THEN the button MUST be disabled
- AND the tooltip shows "Sin sucursal asignada"

#### Scenario: Valid location enables button

- GIVEN a provider whose `location` is defined and non-null
- WHEN the row renders
- THEN the button MUST be enabled

### Requirement: Transactional Filter Pre-selection

On navigation, the calendar MUST pre-select the provider's location and the provider in the filter dropdowns. This pre-selection MUST be consumed once and MUST NOT persist on page refresh.

#### Scenario: Filters pre-selected on navigation

- GIVEN a provider with a valid location
- WHEN the user clicks "Ver Agenda"
- THEN the calendar location filter shows that provider's location
- AND the provider filter shows that provider
- AND bookings are loaded for that provider/location

#### Scenario: Pre-selection consumed on use

- GIVEN the user navigated to calendar via "Ver Agenda" and filters are pre-selected
- WHEN the page is reloaded
- THEN the filters return to defaults (no pre-selection)

### Requirement: Welcome Toast

After successful navigation with pre-selected filters, a toast MUST appear: "Mostrando agenda de {providerName} en {locationName}".

#### Scenario: Toast on pre-selected load

- GIVEN the user navigates to calendar via "Ver Agenda"
- WHEN the calendar loads with pre-selected filters applied
- THEN a toast message displays "Mostrando agenda de {providerName} en {locationName}"

### Requirement: Consistent Desktop and Mobile Behavior

Desktop (table) and mobile (card) views MUST behave identically for all agenda-button scenarios.

#### Scenario: Same behavior across views

- GIVEN the providers list is rendered on desktop and mobile
- WHEN the user clicks "Ver Agenda" on either view
- THEN navigation, filter pre-selection, and toast behavior MUST be identical
