# Client Notifications Specification

## Purpose

Per-client notification preferences: five backend flags (`email_new_booking`, `email_booking_confirmation`, `email_booking_cancellation`, `whatsapp_reminder`, `whatsapp_cancellation_confirmation`) read from and written to `GET/PATCH /api/v1/clients/{id}`. The frontend only reads and writes preferences; sending is handled by the backend (carlitox + cron).

## Requirements

### Requirement: Initialize toggles from client notification prefs

The system MUST initialize the notifications section from `client.notification_prefs` returned by GET /clients/{id}. It MUST NOT default every flag to `false` when the response provides values.

#### Scenario: Toggles reflect GET values on open

- GIVEN staff opens a client detail
- WHEN the client loads via GET /clients/{id}
- THEN the five toggles reflect the `notification_prefs` values of the response

### Requirement: Persist toggle changes with a partial PATCH

When staff changes a flag, the system MUST send PATCH /clients/{id} with a partial body containing only that flag under `notification_prefs`.

#### Scenario: Toggle sends partial PATCH

- GIVEN the client detail is open with `whatsapp_reminder` enabled
- WHEN staff disables `whatsapp_reminder`
- THEN a PATCH /clients/{id} is sent with `{ "notification_prefs": { "whatsapp_reminder": false } }`
- AND no other flag is included in the payload

#### Scenario: Failed PATCH rolls back

- GIVEN staff changes a notification flag
- WHEN the PATCH /clients/{id} request fails
- THEN the toggle returns to its previous value
- AND an error message is shown to staff

### Requirement: Render five grouped toggles with per-flag tooltips

The notifications section MUST render exactly five toggles grouped by channel — three Email flags and two WhatsApp flags — each with a clear label and an info icon whose tooltip describes the flag's event, channel, and timing.

#### Scenario: Exactly five flags, no citaWa

- GIVEN the notifications section is displayed
- WHEN it renders
- THEN the three Email flags and the two WhatsApp flags appear
- AND `citaWa` does not appear

#### Scenario: Accessible per-flag tooltip

- GIVEN the notifications section is displayed
- WHEN staff focuses each flag's info icon
- THEN a tooltip explains the flag's event, channel, and timing
- AND it is reachable by keyboard

### Requirement: Repopulate prefs when reopening the same client

The system MUST repopulate the toggles from GET /clients/{id} each time a client detail opens, including reopening the same client without an intermediate close. Stale in-memory values MUST NOT survive.

#### Scenario: No stale state on same-client reopen

- GIVEN the dialog is open for a client and a flag was changed during this session
- WHEN the same client's detail is reopened without closing the dialog
- THEN the five toggles match the `notification_prefs` from GET /clients/{id}
- AND no stale local value remains
