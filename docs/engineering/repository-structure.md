# Estructura Del Repositorio

## Raiz

- `README.md`: documentacion existente bilingue del proyecto.
- `package.json` y `package-lock.json`: scripts y dependencias npm.
- `angular.json`: configuracion Angular CLI.
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.spec.json`: TypeScript y tests.
- `.editorconfig`, `.gitignore`, `.vscode/`: configuracion de editor.
- `public/`: assets publicos.
- `src/`: codigo de aplicacion.
- `docs/`: documentacion tecnica creada por este levantamiento.

## src

- `src/main.ts`: bootstrap Angular.
- `src/index.html`: HTML base.
- `src/styles.scss` y `src/styles/_tokens.scss`: estilos globales y tokens.
- `src/environments/`: configuracion de entorno.
- `src/assets/`: imagenes y fuentes.
- `src/app/`: aplicacion Angular.

## src/app

- `core/`: modelos, servicios, guards, interceptores e i18n.
- `features/auth/`: login y registro.
- `features/admin/`: dashboard, calendario, bookings, clients, locations, packs y providers.
- `features/provider/`: calendario y disponibilidad provider.
- `layouts/`: layouts admin/provider.
- `shared/`: componentes, pipes, validadores, constantes y utilidades.

## Conteo observado

- Archivos TypeScript bajo `src/app`: 58.
- Specs bajo `src/app`: 4.

Fuente: listado del repositorio con `rg --files` y conteos sobre `src/app`.

