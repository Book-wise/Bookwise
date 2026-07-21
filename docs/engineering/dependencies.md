# Dependencias

## Runtime

Declaradas en `package.json`:

- Angular 21 (`@angular/*`).
- PrimeNG 21 y PrimeIcons.
- `@primeng/themes`.
- FullCalendar 6 (`core`, `daygrid`, `interaction`, `list`, `timegrid`).
- Chart.js 4.
- `intl-tel-input`.
- RxJS 7.
- `tslib`.

## Desarrollo

Declaradas en `package.json`:

- `@angular/build`
- `@angular/cli`
- `@angular/compiler-cli`
- `typescript`
- `vitest`
- `jsdom`

## Package manager

`package.json` declara:

```json
"packageManager": "npm@11.12.1"
```

## Assets empaquetados

`angular.json` copia:

- `public/**`
- `src/assets/**`
- `node_modules/intl-tel-input/dist/js/utils.js` hacia `assets/intl-tel-input`

