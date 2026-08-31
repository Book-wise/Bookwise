# Booking Dialog Navigation Specification

## Purpose

Define main-tab keep-alive state preservation and a single booking source of truth inside the reservation detail dialog.

## Requirements

### Requirement: Preserve Reserva state across main-tab navigation

The system MUST preserve the Reserva form state (date, time, professional, notes) and in-progress client edits when staff switches among main tabs and returns. The selected main tab MUST always reflect the visible content.

#### Scenario: State preserved across main-tab round-trip

- GIVEN Reserva has date, time, professional, and notes entered
- WHEN staff switches to Historial and returns to Reserva
- THEN all entered values remain intact

#### Scenario: Reserva remains active after returning

- GIVEN staff switches from Reserva to Historial
- WHEN staff returns to Reserva
- THEN the Reserva tab is marked active

### Requirement: Consolidate booking into a single dialog source of truth

The system MUST use one canonical booking source for the header, Reserva tab, patient card, and footer. Reservation edits MUST update the same source read by the delete action.

#### Scenario: Canonical booking across dialog surfaces

- GIVEN a reservation dialog is open
- WHEN staff edits reservation fields
- THEN the header, patient card, and delete action all read the updated booking

### Requirement: Show complete patient card data

The patient card MUST render email and phone in addition to the name, and the notifications block MUST remain visible.

#### Scenario: Complete client data and notifications visible

- GIVEN a reservation has a client with email and phone
- WHEN the Reserva tab is displayed
- THEN the patient card shows name, email, and phone
- AND the notifications block is visible
