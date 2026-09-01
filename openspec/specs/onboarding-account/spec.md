# onboarding-account Specification

## Purpose

Define the post-registration account lifecycle for phase 1 (one account = one
business): verifying the email reached via the signup callback, onboarding the
first business (the `admin_general`), and routing the user after login according
to `onboarding_complete`.

## Requirements

### Requirement: Email verification

The system MUST expose a verification view at the email-callback URL
(`/verificar-email?token=...`) that calls `PATCH /auth/verify-email` with
`{ token }` before any authenticated flow. On success the view MUST show a success
state with the returned `email_verified_at` and a link to login; on failure it MUST
show an error state and a link to login, without enabling further onboarding.

#### Scenario: Valid token

- GIVEN a signed-up user opens `/verificar-email?token=<valid>`
- WHEN the view loads
- THEN it calls `PATCH /auth/verify-email` with the token
- AND it displays the success state with `email_verified_at` and a login link

#### Scenario: Invalid or expired token

- GIVEN a user opens `/verificar-email?token=<invalid>`
- WHEN the view loads
- THEN it shows the error state and a login link
- AND it does NOT allow proceeding to onboarding

### Requirement: Business onboarding

The system MUST show the business-onboarding form when `GET /auth/me` returns
`onboarding_complete=false`. The form collects name, RUT, email, address, phone and
plan, and SHALL validate every field on the front end (Chilean RUT, email, phone,
required) before calling `POST /businesses`. Invalid forms MUST NOT be submitted.

#### Scenario: Invalid form is not submitted

- GIVEN `onboarding_complete=false` and the onboarding form is shown
- WHEN the user submits with an invalid RUT, email, phone, or missing required field
- THEN no `POST /businesses` request is sent
- AND per-field validation errors are displayed

#### Scenario: Successful business creation

- GIVEN `onboarding_complete=false` and a valid form
- WHEN the user submits
- THEN `POST /businesses` is sent with the collected payload
- AND on 201 the user is redirected to the admin dashboard

### Requirement: Post-login redirection

The system MUST route the authenticated user after login according to
`onboarding_complete`: users with `onboarding_complete=false` MUST land on business
onboarding; users with `onboarding_complete=true` MUST land on the admin dashboard.

#### Scenario: Unfinished onboarding

- GIVEN a verified user with `onboarding_complete=false`
- WHEN they log in
- THEN they are redirected to the business-onboarding view

#### Scenario: Completed onboarding

- GIVEN a user with `onboarding_complete=true`
- WHEN they log in
- THEN they land on the admin dashboard
