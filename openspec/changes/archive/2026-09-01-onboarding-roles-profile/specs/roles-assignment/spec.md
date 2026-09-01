# roles-assignment Specification

## Purpose

Define how the `admin_general` manages business roles: listing the six available
roles and assigning them to providers, while keeping the `admin_general` role
unique and non-removable per business.

## Requirements

### Requirement: List business roles

The system MUST fetch `GET /roles` and SHALL display the six business roles
(`admin_general`, `admin_local`, `recepcionista`, `recepcionista_readonly`,
`staff`, `staff_readonly`). Business roles are a layer separate from `users.role`.

#### Scenario: Admin general lists roles

- GIVEN an authenticated `admin_general`
- WHEN they open the roles screen
- THEN `GET /roles` is called
- AND the six business roles are displayed

### Requirement: Assign roles to a provider

The `admin_general` MUST be able to assign roles to a provider by calling
`PATCH /providers/{id}/roles` with `{ roles: [...] }`, which replaces the
provider's existing role set.

#### Scenario: Assign roles successfully

- GIVEN an `admin_general` viewing a provider with a roles selector
- WHEN they save a selection
- THEN `PATCH /providers/{id}/roles` is sent with the full role array
- AND the provider's role set reflects the selected roles

#### Scenario: Empty or invalid selection

- GIVEN a provider roles form
- WHEN the admin saves without any roles or with an invalid role
- THEN the request is blocked and a validation error is shown

### Requirement: admin_general is unique and non-removable

The system MUST enforce that a business has exactly one `admin_general` (assigned
at business creation) and SHALL NOT allow removing or reassigning that role through
the roles-assignment UI.

#### Scenario: Removing admin_general is blocked

- GIVEN an `admin_general` editing a provider that holds the role
- WHEN an attempt is made to remove `admin_general`
- THEN the UI prevents the removal
- AND the corresponding `PATCH` role removal is not emitted
