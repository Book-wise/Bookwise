# business-profile Specification

## Purpose

Define the profile view that loads `GET /auth/me` and presents the user's personal
data alongside the business/tenant data, enforcing that the business identity
fields are immutable (read-only) with a warning.

## Requirements

### Requirement: Profile view

The system MUST provide a profile view that fetches `GET /auth/me` (Bearer) and
SHALL display personal information (name, email, phone) and business information
(name, RUT, address, phone, plan). The user email SHALL be editable when a save
endpoint exists; otherwise it SHALL be shown read-only and the limitation
documented.

#### Scenario: Profile displays personal and business data

- GIVEN an authenticated user with a business
- WHEN they open the profile view
- THEN `GET /auth/me` is called
- AND personal data and business data are rendered

#### Scenario: Profile with no business

- GIVEN an authenticated user with `business=null`
- WHEN they open the profile view
- THEN the business section shows a call-to-action to complete onboarding
- AND no business fields are rendered as editable

### Requirement: Immutable business identity fields

The system MUST render `business.rut` and `business.email` as read-only and MUST
display a warning that these identity fields cannot be edited; changing them
requires a new account/business.

#### Scenario: Business fields shown read-only

- GIVEN a business with a RUT and an email
- WHEN the profile view renders the business section
- THEN RUT and email are non-editable controls
- AND a warning explains they cannot be altered

#### Scenario: Editing attempted

- GIVEN the read-only business fields
- WHEN the user tries to change RUT or email
- THEN no editable control is available
- AND no update request is produced
