# Patient Dialog Navigation Specification

## Purpose

Define reservation-dialog navigation while preserving persisted data and dialog-scoped patient state.

## Requirements

### Requirement: Preserve dialog context while navigating patient details

The system MUST keep the dialog header and main tabs visible. On open, `p-dialog-content` MUST show Reservation with `bw-patient-card`. The main `Reserva` tab MUST remain selected during patient detail.

#### Scenario: Open reservation content

- GIVEN a reservation dialog is opened
- WHEN its content is rendered
- THEN the header and tabs remain visible and Reservation shows the patient card

#### Scenario: Enter patient detail

- GIVEN Reservation is visible
- WHEN staff selects a patient detail tab from the patient card
- THEN only `p-dialog-content` changes and the main `Reserva` tab remains selected

### Requirement: Support all patient detail tabs and return

The system MUST support `planes`, `sesiones`, `prepago`, and `recientes` through one patient-card flow. Each detail view MUST fill the entire `p-dialog-content` area (not a collapsed in-card panel) and MUST provide "Volver a la reserva"; internal tabs MUST NOT be entered elsewhere. Sub-tab buttons MUST remain visible and MUST be disabled when their category has no data.

(Previously: detail content replaced only the content area; no full-content or disabled-button behavior.)

#### Scenario: Navigate to each detail tab

- GIVEN the patient card is visible
- WHEN staff selects `planes`, `sesiones`, `prepago`, or `recientes`
- THEN the selected detail content fills the entire content area

#### Scenario: Disabled sub-tab when category empty

- GIVEN a category has no data
- WHEN the patient card is displayed
- THEN that sub-tab button is visible but disabled

#### Scenario: Return to Reservation

- GIVEN any patient detail view is visible
- WHEN staff selects "Volver a la reserva"
- THEN Reservation replaces the detail content and the main `Reserva` tab remains selected

### Requirement: Restore persisted reservation and patient data

The system MUST preserve in-progress reservation edits and client edits on return, and restore the persisted patient snapshot on return. The current save flow and confirmation toast MUST remain unchanged.

(Previously: unsaved reservation edits were discarded on return and persisted values were shown.)

#### Scenario: Return after saved changes

- GIVEN staff saved reservation changes and received the existing toast
- WHEN staff visits a patient detail tab and returns
- THEN Reservation shows the saved persisted values
- AND the confirmation toast remains unchanged

#### Scenario: Return after unsaved edits

- GIVEN staff edits reservation fields without saving
- WHEN staff visits a patient detail tab and returns
- THEN the unsaved edits are preserved and shown

#### Scenario: Preserve in-progress client edit

- GIVEN staff is mid-way through editing the client
- WHEN staff navigates to a patient detail tab and returns
- THEN the in-progress client edit is preserved

### Requirement: Preserve and isolate dialog-scoped state

The system MUST preserve notification checkbox values, active detail state, and loaded detail data across internal tabs. Accordion expansion MUST be ephemeral. State MUST be isolated per dialog, reset on close or another reservation, and MUST NOT reset on internal-tab changes.

#### Scenario: Preserve state across internal tabs

- GIVEN staff changes notification checkboxes and opens one patient detail tab
- WHEN staff switches among the four detail tabs and returns
- THEN checkbox values and available detail data remain
- AND accordion expansion is not required to remain expanded

#### Scenario: Reset lifecycle state

- GIVEN a dialog has patient navigation or notification state
- WHEN the dialog closes or opens another reservation
- THEN the prior state is cleared and cannot appear in the next reservation or dialog instance

### Requirement: Handle detail data states

Each detail tab MUST provide loading, empty, and error states without hiding the header or main tabs. A failed load MUST NOT discard persisted patient or reservation data.

#### Scenario: Loading, empty, and error responses

- GIVEN a selected detail tab is loading, has no records, or fails to load
- WHEN its content is displayed
- THEN the corresponding loading, empty, or error state is shown
- AND staff can return to Reservation

### Requirement: Persist notification preferences via client-notifications

The system MUST delegate notification preference persistence to the `client-notifications` capability: values MUST initialize from `client.notification_prefs` (GET /clients/{id}) and MUST be written via a partial PATCH /clients/{id} on toggle change. Dialog navigation MUST preserve these values across internal tabs per that capability.

(Previously: the persistence contract was pending — the system retained values in memory without assuming an endpoint, payload, or save behavior.)

#### Scenario: Values persist via confirmed contract

- GIVEN staff changes notification toggle values in the patient card
- WHEN staff navigates internally or returns to Reservation
- THEN the values remain available per the `client-notifications` capability
- AND persistence follows that capability's GET/PATCH behavior

### Requirement: Reload detail data on dialog open

The system MUST reload sub-tab detail data when the dialog opens and MUST NOT cache per-client detail data across opens.

#### Scenario: Fresh detail data on open

- GIVEN a reservation dialog is closed
- WHEN the dialog is opened for a reservation
- THEN the detail tab data is loaded fresh for that reservation

### Requirement: Reset scroll on return to Reserva

The system MUST reset the content scroll to the top when staff returns from a detail tab to Reserva.

#### Scenario: Scroll reset on return

- GIVEN staff scrolled within a detail view
- WHEN staff selects "Volver a la reserva"
- THEN the Reserva content scroll is reset to the top

### Requirement: Read-only detail listings this iteration

The detail listings (`planes`, `sesiones`, `prepago`, `recientes`) MUST be read-only in this iteration. The architecture MUST NOT prevent future edit, charge, or reschedule actions.

#### Scenario: Read-only listings without blocking future actions

- GIVEN a detail listing is displayed
- WHEN staff views its records
- THEN no edit, charge, or reschedule action is offered
- AND the architecture leaves room for future actions
