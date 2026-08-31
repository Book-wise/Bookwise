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

The system MUST support `planes`, `sesiones`, `prepago`, and `recientes` through one patient-card flow. Each detail view MUST provide “Volver a la reserva”; internal tabs MUST NOT be entered elsewhere.

#### Scenario: Navigate to each detail tab

- GIVEN the patient card is visible
- WHEN staff selects `planes`, `sesiones`, `prepago`, or `recientes`
- THEN the selected detail content replaces only the content area

#### Scenario: Return to Reservation

- GIVEN any patient detail view is visible
- WHEN staff selects “Volver a la reserva”
- THEN Reservation replaces the detail content and the main `Reserva` tab remains selected

### Requirement: Restore persisted reservation and patient data

The system MUST restore the persisted patient snapshot and all visible persisted reservation data on return. The current save flow and confirmation toast MUST remain unchanged.

#### Scenario: Return after saved changes

- GIVEN staff saved reservation changes and received the existing toast
- WHEN staff visits a patient detail tab and returns
- THEN Reservation shows the saved persisted values
- AND the confirmation toast remains unchanged

#### Scenario: Return after unsaved edits

- GIVEN staff edits reservation fields without saving
- WHEN staff visits a patient detail tab and returns
- THEN the unsaved edits are discarded and persisted values are shown

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

### Requirement: Maintain the pending notification persistence contract

The system MUST retain each notification checkbox value and expose it for the agreed backend persistence contract. It MUST NOT assume an endpoint, payload, or save behavior before that contract is confirmed.

#### Scenario: Notification values await backend contract

- GIVEN staff changes notification checkbox values
- WHEN staff navigates internally or returns to Reservation
- THEN the values remain available for the agreed persistence flow
- AND no unconfirmed backend request is required by this specification
