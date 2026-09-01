# Delta for Patient Dialog Navigation

## RENAMED Requirements

### Requirement: Maintain the pending notification persistence contract → Persist notification preferences via client-notifications

(Reason: the backend persistence contract is confirmed; the requirement no longer describes pending behavior.)
(Migration: references to pending-contract behavior now resolve to the `client-notifications` capability.)

## MODIFIED Requirements

### Requirement: Persist notification preferences via client-notifications

The system MUST delegate notification preference persistence to the `client-notifications` capability: values MUST initialize from `client.notification_prefs` (GET /clients/{id}) and MUST be written via a partial PATCH /clients/{id} on toggle change. Dialog navigation MUST preserve these values across internal tabs per that capability.

(Previously: the persistence contract was pending — the system retained values in memory without assuming an endpoint, payload, or save behavior.)

#### Scenario: Values persist via confirmed contract

- GIVEN staff changes notification toggle values in the patient card
- WHEN staff navigates internally or returns to Reservation
- THEN the values remain available per the `client-notifications` capability
- AND persistence follows that capability's GET/PATCH behavior
