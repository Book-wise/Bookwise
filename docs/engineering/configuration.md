# Configuracion

## Angular

`angular.json` define un proyecto application llamado `bookwise`, con:

- `sourceRoot`: `src`.
- Prefijo de componentes: `bw`.
- Estilos SCSS.
- Builder: `@angular/build:application`.
- Entrada browser: `src/main.ts`.
- Estilos globales: `node_modules/primeicons/primeicons.css` y `src/styles.scss`.
- Assets: `public`, `src/assets` y `intl-tel-input` utils desde `node_modules`.
- Build production con budgets y output hashing.
- Serve development por defecto.
- Test builder `@angular/build:unit-test`.

## TypeScript

`tsconfig.json` usa `strict: true`, `target: ES2022`, `module: preserve`, `isolatedModules: true` y strict templates de Angular.

Aliases configurados:

- `@core/*`
- `@models`
- `@models/*`
- `@services/*`
- `@guards/*`
- `@interceptors/*`
- `@i18n/*`
- `@shared/*`
- `@layouts/*`
- `@features/*`
- `@env/*`

## Ambientes

- Desarrollo: `src/environments/environment.ts` con API `http://127.0.0.1:9999/api/v1`.
- Produccion: `src/environments/environment.prod.ts` con API `/api/v1`.

## UI global

`src/app/app.config.ts` configura PrimeNG con preset Aura, `darkModeSelector: false` y traducciones de calendario en espanol.

