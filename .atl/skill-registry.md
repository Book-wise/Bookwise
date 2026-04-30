# Skill Registry

## Project Skills

| Name | Trigger | Description |
|------|---------|-------------|
| angular-developer | Angular projects, components, services, signals, forms, routing, SSR, testing | Generates Angular code and provides architectural guidance |

**Location**: `.agents/skills/angular-developer/SKILL.md`

## System Skills (Available)

| Name | Trigger |
|------|---------|
| sdd-init | "sdd init", "iniciar sdd", "openspec init" |
| sdd-explore | Exploring codebase, investigating ideas |
| sdd-propose | Creating change proposals |
| sdd-spec | Writing specifications |
| sdd-design | Creating technical designs |
| sdd-tasks | Breaking down into tasks |
| sdd-apply | Implementing tasks |
| sdd-verify | Validating implementation |
| sdd-archive | Archiving completed changes |
| brainstorming | Before creative work, creating features |
| test-driven-development | Before writing implementation code |
| systematic-debugging | Bug, test failure, unexpected behavior |
| judgment-day | "judgment day", adversarial review |

## Project Conventions

- **Tech Stack**: Angular 21, PrimeNG, Vitest
- **Formatter**: Prettier (singleQuote: true)
- **Architecture**: features/, layouts/, core/, shared/
- **Testing**: Vitest (`ng test`)

## Notes

- Strict TDD Mode is enabled (test runner detected)
- Use `angular-developer` skill for any Angular-specific implementation
- All SDD phases should follow the detected project conventions