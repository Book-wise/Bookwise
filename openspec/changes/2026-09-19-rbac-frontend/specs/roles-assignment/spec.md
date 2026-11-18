# Delta for Roles Assignment

## MODIFIED Requirements

### Requirement: List business roles

The system MUST fetch `GET /v1/roles` and SHALL display the six business roles
(`admin_general`, `admin_local`, `recepcionista`, `recepcionista_readonly`,
`staff`, `staff_readonly`) keyed by `slug`. `name` is display-only. When the
response is 409 `onboarding_required`, the system MUST redirect to onboarding
instead of showing a generic error. Business roles are a layer separate from
`users.role`.

(Previously: roles were keyed by `name`; 409 was not handled.)

#### Scenario: Admin general lists roles

- GIVEN an authenticated `admin_general`
- WHEN they open the roles screen
- THEN `GET /v1/roles` is called
- AND the six business roles are displayed keyed by `slug`

#### Scenario: Tenantless admin

- GIVEN the admin has no tenant
- WHEN `GET /v1/roles` responds 409 `onboarding_required`
- THEN the admin is redirected to onboarding

### Requirement: Assign roles to a provider

The `admin_general` MUST be able to assign roles to a provider by calling
`PATCH /v1/providers/{id}/roles` with `{ roles: [slug] }`, which replaces the
provider's existing role set. The request MUST send slugs, never display names.
A professional MUST hold at least one role, so the system MUST block saving an
empty set; duplicate slugs MUST NOT be sent.

(Previously: the request sent display names.)

#### Scenario: Assign roles successfully

- GIVEN an `admin_general` viewing a provider with a roles selector
- WHEN they save a selection
- THEN `PATCH /v1/providers/{id}/roles` is sent with the full array of slugs
- AND the provider's role set reflects the selected roles

#### Scenario: Empty selection is blocked

- GIVEN a provider roles form
- WHEN the admin attempts to save with no roles
- THEN the request is blocked and a validation error is shown

#### Scenario: Invalid selection rejected by the API

- GIVEN a provider roles form
- WHEN the API responds 422 (duplicate slug or display name)
- THEN the local state reverts and the provider roles are refetched

### Requirement: admin_general is unique and non-removable

The system MUST enforce that a business has exactly one `admin_general` (assigned
at business creation) and SHALL NOT allow removing or reassigning that role
through the roles-assignment UI. The guard MUST match by `slug`.

(Previously: the guard compared display `name`, so it never matched.)

#### Scenario: Removing admin_general is blocked

- GIVEN an `admin_general` editing a provider that holds the role
- WHEN an attempt is made to remove `admin_general`
- THEN the UI prevents the removal
- AND the corresponding `PATCH` role removal is not emitted

## ADDED Requirements

### Requirement: Roles are keyed by slug

All role consumers MUST key roles by `slug` and MUST NOT use `name` as an
identifier. The `Role` model MUST NOT expose a `label` field. When no i18n key
exists for a role, the display label MUST fall back to the backend `name`.

#### Scenario: Role display fallback

- GIVEN a role whose `slug` has no i18n key
- WHEN its label is rendered
- THEN the backend `name` is displayed

#### Scenario: Providers filtered by slug

- GIVEN providers returned with `roles: [{ id, slug, name }]`
- WHEN the admin calendar filters professionals that attend
- THEN the filter matches `staff` and `staff_readonly` by `slug`
