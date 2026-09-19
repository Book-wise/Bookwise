# Delta for Role Permissions Matrix

## Purpose

Let an `admin_general` view the global permission catalog, view a role's current
permissions, and replace that role's permission set. Editing permissions does NOT
change real access yet — backend enforcement is deferred.

## ADDED Requirements

### Requirement: View the permission catalog

The system MUST fetch `GET /v1/roles/permissions` and render the returned groups
and items dynamically. The UI MUST NOT hardcode group names, item keys, or item
counts. Each item MUST display a label resolved by permission key via i18n,
falling back to the backend `label` for unknown keys. This endpoint does not
require a tenant.

#### Scenario: Catalog rendered dynamically

- GIVEN an authenticated `admin_general` with `role:admin` + `scope:roles:read`
- WHEN the permissions tab loads
- THEN `GET /v1/roles/permissions` is called
- AND every returned group and item is rendered without hardcoded values

#### Scenario: Unknown key falls back to backend label

- GIVEN the catalog returns a key with no i18n entry
- WHEN the item is rendered
- THEN the backend `label` is displayed

#### Scenario: Catalog unavailable

- GIVEN `GET /v1/roles/permissions` fails or returns no groups
- WHEN the permissions tab loads
- THEN an error or empty state is shown and no matrix is rendered

### Requirement: View a role's current permissions

The system MUST fetch `GET /v1/roles` and show each role keyed by `slug`, with
its `permissions` keys selected in the matrix. Roles are identified by `slug`;
`name` is display-only.

#### Scenario: Role permissions preselected

- GIVEN the roles list loaded successfully
- WHEN the admin selects a role in the master list
- THEN the matrix preselects exactly the keys in that role's `permissions`
- AND the role is tracked by `slug`

#### Scenario: Tenantless admin

- GIVEN `GET /v1/roles` responds 409 `onboarding_required`
- WHEN the admin opens `/admin/roles`
- THEN the admin is redirected to onboarding
- AND the 409 is not shown as a generic error

### Requirement: Replace a role's permission set

The system MUST send `PATCH /v1/roles/{id}/permissions` with
`{ "permissions": string[] }` (replace semantics). It MUST NOT apply optimistic
state, MUST dedupe keys before sending, and MUST confirm before clearing all
permissions. A 200 response MUST update the local role from the response `data`.

#### Scenario: Save edited permissions

- GIVEN the admin changed the selected keys for a role
- WHEN they save
- THEN the body is the full deduped key set for that role
- AND on 200 the role reflects the response `data.permissions`

#### Scenario: Clearing all permissions requires confirmation

- GIVEN the admin deselected every key
- WHEN they attempt to save
- THEN a confirmation is required before the request is sent
- AND an empty array is sent only after confirmation

#### Scenario: 422 or 404 reverts and refetches

- GIVEN a save request
- WHEN the API responds 422 (unknown/duplicate key) or 404 (role not found)
- THEN the local matrix reverts and `GET /v1/roles` is refetched
- AND an actionable error is shown

### Requirement: Enforcement warning and no restore control

The UI MUST display a persistent warning that editing permissions does not yet
change real access, and MUST NOT offer a "restore baseline" action.

#### Scenario: Warning and no restore

- GIVEN the permissions tab is open
- WHEN it is rendered
- THEN the deferred-enforcement warning is visible
- AND no restore-baseline control exists
