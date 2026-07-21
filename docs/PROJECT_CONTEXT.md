# Contexto local: Bookwise Frontend

Esta ficha complementa la documentación existente del frontend y no la reemplaza. Debe actualizarse sólo después de verificar el código y Git.

## Hechos verificados en el checkout

- Aplicación Angular con componentes standalone y estilos SCSS.
- `package.json` declara Angular 21, TypeScript, RxJS, PrimeNG/PrimeIcons, FullCalendar, Chart.js e `intl-tel-input`.
- La configuración de aplicación registra Router y HTTP Client con interceptor de autenticación.
- Los scripts declarados son `start`, `build`, `watch` y `test`.

## Operación

No modificar directamente ramas de integración. Antes de cambios, revisar instrucciones locales, estado, rama base, PRs y trabajo previo. Para validar, usar scripts reales del manifiesto y registrar resultado, commit y limitaciones. Verificar siempre environments, URL de API, guards, interceptor, roles, mocks, budgets y contratos contra la API antes de afirmar comportamiento.

## Límites

No registrar tokens ni datos reales. No cambiar contratos de API, branding, roles, flujos de reservas o estrategia de estado por iniciativa propia. Los archivos actuales bajo `docs/` se preservan como documentación local existente; esta ficha no certifica que estén actualizados.
