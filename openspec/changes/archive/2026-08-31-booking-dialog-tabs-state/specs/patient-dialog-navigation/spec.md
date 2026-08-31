# Delta for Patient Dialog Navigation

## MODIFIED Requirements

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

## ADDED Requirements

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
