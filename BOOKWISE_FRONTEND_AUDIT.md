# Auditoría Funcional, Técnica y de UX — Bookwise Frontend

**Repositorio auditado:** `Bookwise` (frontend Angular). Repositorio hermano no auditado en profundidad: `Bookwise-API` (backend Laravel), consultado únicamente para verificar la integración.
**Fecha de auditoría:** 2026-07-06.
**Método:** lectura directa de código fuente, ejecución real de `npm test` y `ng build --configuration production`, `npm audit`, `npm outdated`, y cruce contra la documentación previa existente en `docs/` (aparentemente producida por un audit anterior, posiblemente el "informe de Gepeto" referido en el encargo — no se encontró autoría explícita en los archivos).
**Convención usada en todo el documento:** **Hecho** = verificado directamente leyendo código o ejecutando un comando; **Inferencia** = deducción razonable no confirmada al 100%; **No verificado** = no se pudo comprobar en esta fase.

No se rediseñó, no se cambió el framework, no se modificaron contratos de API, no se publicó nada y no se usaron credenciales reales. Este documento es un diagnóstico, no una certificación de cumplimiento (en particular, no se declara conformidad WCAG).

---

## 1. Resumen ejecutivo

Bookwise-Frontend es una SPA Angular 21 standalone (sin NgModules, sin store global, con `signal()`), bien estructurada por *features*, con una base de código relativamente joven y disciplinada en varios aspectos (manejo de errores HTTP centralizado, buen uso de `@for...track`, lazy loading al 100% de las rutas, tests unitarios de calidad aunque escasos). Sin embargo, **el producto no está listo para producción** por una combinación de bloqueantes reales:

- **El build de producción falla** (`ng build --configuration production` termina con `Application bundle generation failed`) por presupuesto de CSS excedido en 3 componentes.
- **El build de producción, aunque se corrigiera el punto anterior, seguiría apuntando al backend local del desarrollador** (`http://127.0.0.1:9999/api/v1`), porque `angular.json` no define ningún `fileReplacements` — `environment.prod.ts` es código muerto que nunca se usa.
- **Al menos 3 flujos de negocio están rotos por falta de endpoints en el backend**: registro de usuarios, cobro/pagos (ventas y transacciones), y reprogramación por drag&drop de bloqueos de horario.
- **La gestión administrativa de Clientes, Profesionales, Sedes y Packs es de solo lectura** pese a que la interfaz simula tener botones de edición — no hacen nada.
- No hay CI/CD, Dockerfile, linter configurado ni Storybook.

El núcleo funcional real y más maduro del sistema es el **calendario de reservas** (`/admin/calendar` y `/provider`), que sí está bien resuelto de punta a punta: creación, edición, cancelación, drag&drop de reservas, bloqueos de horario (salvo su reprogramación), toasts de éxito/error y manejo diferenciado de errores de negocio.

Este informe documenta 36 hallazgos concretos clasificados por severidad, con evidencia de archivo y línea, y propone un plan de estabilización ordenado en la sección 17.

---

## 2. Stack tecnológico

| Categoría | Valor | Evidencia |
|---|---|---|
| Framework | Angular | `package.json`: `@angular/core: ^21.1.0` (instalado `21.2.10`) |
| Lenguaje | TypeScript | `~5.9.2` (instalado `5.9.3`) |
| Runtime | Node.js | Sin `.nvmrc` en el repo (**No verificado** qué versión exige el equipo); entorno de esta auditoría: Node v22.22.1, npm 9.2.0 |
| Gestor de paquetes | npm | `package-lock.json` presente; `package.json` declara `"packageManager": "npm@11.12.1"` — **discrepancia**: el npm real disponible en el entorno (9.2.0) no coincide con el declarado |
| Herramienta de build | `@angular/build` (esbuild, "application builder") | `angular.json:21` → `"builder": "@angular/build:application"` |
| Test runner | Vitest | `angular.json` → `"builder": "@angular/build:unit-test"`; `vitest: ^4.0.8` en devDependencies; sin `vitest.config.ts` propio, config embebida en `angular.json` |
| Librería de UI | PrimeNG | `^21.1.6`, preset **Aura** (`@primeng/themes/aura`), con soporte runtime para Lara/Nora vía `ThemeService` |
| Calendario | FullCalendar | `^6.1.20` (core, daygrid, interaction, list, timegrid), wrapper Angular oficial |
| Gráficos | Chart.js | `^4.5.1`, usado en el dashboard |
| Teléfono | intl-tel-input | `^28.0.4`, envuelto en `bw-phone-input` |
| Iconografía | PrimeIcons | única fuente de íconos, 0 usos de SVG inline o de otras librerías (Hecho, por grep) |
| Formularios | Template-driven (`ngModel`, `NgForm`) | **No hay `ReactiveFormsModule`/`FormGroup`/`FormBuilder`** en todo el proyecto (Hecho, grep negativo) |
| Cliente HTTP | `HttpClient` de Angular envuelto en `ApiService` | `src/app/core/services/api.service.ts` |
| Gestión de estado | Sin store global — `signal()`/`computed()` locales y en servicios singleton | 17 archivos usan `signal(`; solo 4 usos de `Subject` (ninguno `BehaviorSubject`) |
| Detección de cambios | Zoneless | `app.config.ts` → `provideZonelessChangeDetection()` |
| Estilos | SCSS con tokens CSS custom | `src/styles.scss` + `src/styles/_tokens.scss` |
| Linter | **No configurado** | Sin script `lint` en `package.json`, sin `.eslintrc*`/`eslint.config.*` en el repo |
| Storybook | **Ausente** | Sin `.storybook/`, sin dependencias de Storybook |
| Contenedores/CI | **Ausentes** | Sin `Dockerfile`, sin `.github/`, sin archivos `.yml`/`.yaml` en el repo (búsqueda exhaustiva) |

---

## 3. Cómo ejecutar el proyecto

### Comandos verificados

```bash
npm install        # dependencias ya estaban instaladas en el entorno auditado, no se reinstaló desde cero
npm test            # ng test → Vitest
npx ng build --configuration production   # build de producción
npm start           # ng serve (usa configuración "development" por defecto)
```

### Resultados reales de ejecución (Hecho)

| Comando | Resultado | Evidencia |
|---|---|---|
| `npx ng test` | ✅ **Éxito** — 4 archivos de test, **98 pruebas, todas pasan**, 35.12s | Salida real del comando, sección "Estado de pruebas" |
| `npx ng build --configuration production` | ❌ **Falla** — `Application bundle generation failed` | 3 errores de presupuesto CSS (ver §13) |
| `ng serve` (dev, puerto 4200 por defecto) | **No verificado en esta pasada** (no se levantó el servidor), pero **inferencia razonable de que funciona**: el `defaultConfiguration` de `serve` es `development`, que no define `budgets`, por lo que los errores de CSS que rompen el build de producción no deberían bloquear el modo desarrollo | `angular.json:71-82` |
| `npm run lint` | No existe el script | `package.json` no define `lint` |

### Variables/requisitos de entorno

- Requiere la API Laravel corriendo en `http://127.0.0.1:9999` (hardcodeado en `src/environments/environment.ts`, no configurable por variable de entorno del sistema operativo — Angular no usa `.env`, usa archivos TS de `environments/`).
- CORS del backend (`Bookwise-API/config/cors.php`) permite explícitamente `http://localhost:4200`, que es el puerto por defecto de `ng serve` — consistente con que el frontend nunca fija un puerto propio en `angular.json`.
- No se usaron credenciales de producción; no se ejecutó contra una base de datos real ni se probaron flujos autenticados end-to-end en esta fase (**No verificado**: comportamiento en runtime autenticado contra la API real).

### Hallazgo crítico de configuración: `environment.prod.ts` nunca se usa

**Hecho.** `angular.json` no contiene **ningún** bloque `fileReplacements` (confirmado por búsqueda exhaustiva del término "environment" en todo el archivo → cero coincidencias). El único punto de importación del entorno es `import { environment } from '@env/environment'` (`api.service.ts:4`, `availability.service.ts`), que el alias de TypeScript (`tsconfig.json`) resuelve siempre a `src/environments/environment.ts` — el archivo de **desarrollo**, con `apiUrl: 'http://127.0.0.1:9999/api/v1'` hardcodeado. Esto significa que **un build de producción, incluso si se arregla el problema de presupuesto de CSS, desplegaría una aplicación que intenta llamar al localhost del desarrollador**, no a la ruta relativa `/api/v1` que define (sin usarse nunca) `environment.prod.ts`. Es un bloqueante de despliegue, no solo un detalle de higiene.

---

## 4. Arquitectura del frontend

**Hecho**, verificado archivo por archivo:

```
src/
├── main.ts                    → bootstrapApplication(App, appConfig), registro de locale es/es-CL
├── index.html
├── app/
│   ├── app.config.ts          → providers raíz: MessageService, ThemeService,
│   │                             provideBrowserGlobalErrorListeners(), provideZonelessChangeDetection(),
│   │                             provideRouter(routes, withComponentInputBinding()),
│   │                             provideHttpClient(withInterceptors([authInterceptor])),
│   │                             provideAnimations(), providePrimeNG({preset: Aura, darkModeSelector:false})
│   ├── app.routes.ts           → 12 rutas, 100% loadComponent (lazy), 0 loadChildren
│   ├── core/
│   │   ├── guards/role.guard.ts        → guard factory client-side por rol
│   │   ├── i18n/validation-translator.ts → traduce mensajes de validación Laravel (parcial, ver §9)
│   │   ├── interceptors/auth.interceptor.ts → inyecta Bearer token, logout automático en 401
│   │   ├── models/{index.ts, requests/, responses/} → tipos de dominio
│   │   └── services/
│   │       ├── api.service.ts       → único punto de contacto HTTP (~30 métodos)
│   │       ├── auth.service.ts      → sesión con signals, persistida en localStorage
│   │       ├── availability.service.ts → MOCK LOCAL con TODOs (ver §7 y §13)
│   │       ├── http-error.service.ts → traducción y toast de errores HTTP
│   │       ├── theme.service.ts     → presets PrimeNG (Aura/Lara/Nora) + persistencia
│   │       ├── language.service.ts, data-cache.service.ts, booking-update.service.ts
│   ├── features/
│   │   ├── auth/{login,register}
│   │   ├── admin/{bookings,calendar,clients,dashboard,locations,packs,providers}
│   │   └── provider/{calendar,availability}
│   ├── layouts/{admin-layout,provider-layout}   → estructuralmente distintos entre sí (ver §9)
│   └── shared/{components,config,constants,pipes,utils,validators}
└── styles/_tokens.scss, styles.scss
```

**Puntos arquitectónicos verificados:**
- Standalone al 100%, sin `NgModule` (Hecho).
- Enrutamiento con guard por rol aplicado en la ruta padre, heredado por hijos (Hecho, `role.guard.ts` + `app.routes.ts`).
- Sin store global (sin NgRx/Zustand en `package.json`, confirmado por grep negativo); estado en `signal()` de servicio o de componente.
- 4 componentes superan las 400 líneas (`full-calendar.component.ts` 697, `booking-form-dialog.component.ts` 671, `provider-calendar.component.ts` 580, `block-time-dialog.component.ts` 409) — coinciden exactamente con los 3 componentes que rompen el presupuesto de CSS de producción, señalando los mismos puntos calientes de deuda técnica desde dos ángulos distintos (tamaño de componente y peso de estilos).
- `shared/utils/` prácticamente sin uso: 1 archivo (`client-similarity.util.ts`), 1 solo consumidor en toda la base de código.
- Sin `ErrorHandler` global custom (solo `provideBrowserGlobalErrorListeners()` nativo de Angular) — sin captura/reporting de errores no controlados en producción.

---

## 5. Mapa de rutas

**Hecho**, verificado contra `src/app/app.routes.ts` línea por línea (el README del proyecto omite 2 de estas rutas: la raíz `/` y el wildcard `**`).

| Ruta | Pantalla | Usuario | Objetivo | Datos requeridos | Estado actual |
|---|---|---|---|---|---|
| `/` | — (redirect) | Público | Redirigir a `/login` | Ninguno | Hecho — funcional |
| `/login` | `LoginComponent` | Público | Autenticación | email, password | Hecho — funcional |
| `/register` | `RegisterComponent` | Público | Alta de cuenta | nombre, email, teléfono, password, confirmación | **Roto** — el endpoint backend no existe (§7) |
| `/admin` | `AdminDashboardComponent` (dentro de `AdminLayoutComponent`) | Admin | KPIs y gráficos generales | `getLocations`, `getProviders`, `getBookings` | Parcial — KPIs reales, gráficos con datos fijos |
| `/admin/locations` | `LocationsListComponent` | Admin | Listar sedes | `getLocations()` | Solo lectura — botones editar/ver sin `(click)` |
| `/admin/providers` | `ProvidersListComponent` | Admin | Listar profesionales | `getProviders()` | Solo lectura — botones sin acción |
| `/admin/calendar` | `FullCalendarComponent` | Admin | Agenda completa: crear/editar/cancelar reservas y bloqueos | `getBookings`, `getBlockedSlots`, filtros | Hecho — el flujo más completo del sistema (con la excepción del drag&drop de bloqueos, roto por backend) |
| `/admin/clients` | `ClientsListComponent` | Admin | Buscar/listar clientes | `getClients({search})`, debounce 300ms | Parcial — búsqueda funcional, sin editar/eliminar desde esta pantalla |
| `/admin/packs` | `PacksListComponent` | Admin | Listar packs de servicios | `getPacks()` | Solo lectura |
| `/provider` | `ProviderCalendarComponent` | Provider | Agenda propia | `getBookings` filtrado, `updateBooking` | Hecho — funcional |
| `/provider/availability` | `ProviderAvailabilityComponent` | Provider | Configurar disponibilidad semanal | `AvailabilityService` (mock) | **Simulado** — no persiste, no valida colisiones reales |
| `**` (wildcard) | — (redirect) | Público | Fallback | Ninguno | Redirige a `/login`, sin página 404 dedicada |

**No existe ninguna ruta de "cliente final"** pese a que el README indica que "los clientes pueden crear sus propias reservas con perfil de usuario". `role.guard.ts` no contempla ningún rol `client`. Las reservas creadas por diálogo interno (`booking-form-dialog`) son siempre operadas por un admin/provider en nombre del cliente, nunca por el cliente mismo.

Tampoco existe ruta propia para los diálogos de `admin/bookings/*` (booking-dialog, booking-form-dialog, block-time-dialog, payment-detail): son modales invocados desde el calendario, no vistas navegables por URL.

---

## 6. Usuarios y flujos detectados

### Tipos de usuario (Hecho, según guards y layouts)

| Usuario | Cómo se identifica | Layout | Objetivos principales |
|---|---|---|---|
| **Admin** | `authService.userRole() === 'admin'`, guardado por `roleGuard(['admin'])` | `AdminLayoutComponent` (sidebar oscuro con gradiente de marca) | Gestionar agenda completa, ver clientes/profesionales/sedes/packs, dashboard general |
| **Provider** (profesional) | `roleGuard(['provider'])` | `ProviderLayoutComponent` (menubar superior, sin dark mode) | Ver/gestionar su propia agenda, configurar disponibilidad |
| **Cliente final** | **No implementado** — mencionado en el README pero sin ruta, rol ni guard | — | Inferencia: se atiende hoy únicamente como registro pasivo (`Client`) gestionado por admin/provider, no como usuario autenticado del frontend |

### Flujos principales verificados

1. **Login → redirección por rol** — Hecho, funcional.
2. **Registro** — Hecho en frontend, **roto en backend** (no hay endpoint).
3. **Gestión de agenda (crear/editar/cancelar reserva)** — Hecho, es el flujo más maduro del producto. Incluye: formulario extenso con paneles colapsables, creación rápida de cliente/servicio desde el mismo diálogo, detección de pacientes similares (debounce 400ms) para evitar duplicados, drag&drop de reservas.
4. **Bloqueo de horarios** — Hecho para crear/listar/eliminar; **roto** para reprogramar por drag&drop (falta `PATCH` en backend).
5. **Cobro de una reserva (venta + abonos)** — Definido en frontend (`payment-tab.component.ts`) pero **no implementado en el backend** (sin rutas de creación de ventas/transacciones). Es un flujo de negocio central (cobrar al cliente) que no puede completarse.
6. **Disponibilidad semanal de provider** — Existe la pantalla, pero es enteramente simulada (mock en memoria, `Math.random()` para horas disponibles, colisión siempre `false`).
7. **Detalle de pago con pestañas de recordatorios/ficha médica/historial** — placeholders sin funcionalidad ("próximamente").
8. **Listados administrativos (clientes, profesionales, sedes, packs)** — de solo lectura pese a apariencia de CRUD completo (botones sin `(click)`).
9. **Logout** — Hecho a nivel de UI (limpia estado local) pero **no revoca el token en el servidor** (no llama al endpoint `POST /auth/logout` que sí existe en el backend).

---

## 7. Integración con la API

### Configuración base (Hecho)

- **URL base dev:** `http://127.0.0.1:9999/api/v1` (`src/environments/environment.ts`).
- **URL base prod (nunca usada, ver §3):** `/api/v1` (`src/environments/environment.prod.ts`).
- **Cliente HTTP:** `ApiService` (`src/app/core/services/api.service.ts`), ~30 métodos, único punto de contacto con el backend.
- **Interceptor:** `authInterceptor` inyecta `Authorization: Bearer <token>` en cada request; en un 401 llama `authService.logout()` y relanza el error. No hay retry ni renovación de sesión (refresh token) — **no existe** ningún mecanismo de renovación.
- **Sesión:** `AuthService` guarda `auth_token` y `auth_user` (objeto completo) en `localStorage` en claro; rehidrata el estado en el constructor al recargar la página.
- **CORS:** `Bookwise-API/config/cors.php` permite explícitamente `http://localhost:4200`; correcto para desarrollo.

### Matriz de integración

| Pantalla o flujo | Acción | Endpoint esperado | Implementado en frontend | Verificado en API | Problema |
|---|---|---|---|---|---|
| Login | Autenticar | `POST /v1/auth/login` | Hecho | Hecho | Ninguno |
| Registro | Crear cuenta | `POST /v1/register` | Hecho (`api.service.ts`) | **No existe** — `routes/api.php` no lo define, `AuthController` no tiene método `register` | **Bloqueante: flujo de registro roto** |
| Logout | Cerrar sesión | `POST /v1/auth/logout` | **No implementado** — solo limpia estado local | Hecho, ruta existe y protegida | Token Sanctum no se revoca en el servidor |
| Alta de servicio | Crear servicio | `POST /v1/services` | Hecho | **No existe** — solo `GET` definidos | Endpoint roto (404/405) |
| Listar sedes/clientes/servicios/profesionales | Cargar listas | `GET /v1/{locations,clients,services,providers}` | Hecho, tipado como array plano | Hecho, pero Laravel pagina (`{data, links, meta}`) | **Mismatch sistémico de forma de respuesta** en 4+ endpoints |
| Crear/editar reserva | Guardar booking | `POST/PATCH /v1/bookings` | Hecho, consumido como objeto plano | Hecho, respuesta envuelta en `{data: ...}` | Mismo mismatch de shape, con evidencia de consumo directo en `booking-form-dialog.component.ts:473` y `reserva-tab.component.ts:129-134` |
| Reprogramar bloqueo (drag&drop) | `PATCH /v1/blocked-slots/{id}` | Hecho, usado en 3 componentes de calendario | **No existe** — solo `GET/POST/DELETE` | **Bloqueante: drag&drop de bloqueos roto en admin y provider** |
| Registrar venta | `POST /v1/sales` | Hecho | **No existe** — solo `GET` | **Bloqueante: no se puede cobrar una reserva** |
| Registrar abono/transacción | `POST /v1/sales/{id}/transactions` | Hecho | **No existe**, ninguna ruta definida | **Bloqueante: no se pueden registrar pagos parciales** |
| Editar venta / listar-eliminar transacciones | `PATCH/GET/DELETE .../transactions` | Definidos en `ApiService` pero **no invocados desde ningún componente** | No existen en backend | Funcionalidad incompleta en ambos lados |
| Disponibilidad de provider | `GET/POST /providers/{id}/availability` | **Mock local**, nunca llama HTTP real | No existe en backend (consistente con el mock) | Simulado, cambios se pierden al recargar |
| Perfil propio (`/me`) | `GET /v1/me` | **No implementado en frontend** | Hecho, existe en backend | Endpoint huérfano sin consumidor |
| Desactivar cliente | `PATCH /clients/{id}/deactivate` | No implementado en frontend | Hecho, existe en backend | Endpoint huérfano |
| Usar sesión de pack | `PATCH /client-packs/{id}/use` | Hecho | Hecho | Ninguno |
| Cancelar reserva | `PATCH /bookings/{id}/cancel` | Hecho | Hecho | Ninguno |
| Editar cliente desde ficha de reserva | `PATCH /clients/{id}` | Hecho | Hecho, pero requiere scope `clients:write` | **Inferencia, no verificado end-to-end**: el rol `provider` solo tiene `['bookings:read','bookings:write','clients:read']` en `UserRole::tokenAbilities()` — si esta acción es alcanzable por un provider, fallaría con 403 |

### Datos simulados / hardcodeados confirmados

- `AvailabilityService` (`src/app/core/services/availability.service.ts`): mock local completo con comentarios TODO explícitos ("Interfaz para disponibilidad - aún sin endpoint en API"), `checkScheduleCollision` siempre retorna `false`, `getAvailableHours` usa `Math.random()`.
- `admin-dashboard.component.ts:88-105`: `initCharts()` usa arrays fijos (`['Centro 1','Centro 2','Centro 3']`, `[12,8,5]`) desconectados de los datos reales cargados por `loadData()`.

---

## 8. Inventario de componentes

### Tokens de diseño (`src/styles/_tokens.scss`) — Hecho

- **Colores de marca:** escala `--bw-50` a `--bw-900` (10 pasos) + alias semánticos (`--color-primary`, `--color-primary-cta`, `--color-accent`).
- **Estado:** solo `--bw-success` y `--bw-warning` (sin `--bw-error`/`--bw-info` propios).
- **Tipografía:** familia `Roboto`, escala de 9 pasos (`--bw-text-2xs` a `--bw-text-4xl`), pesos, tracking, y 9 roles semánticos (`--bw-font-overline/caption/table/body/title/amount/subtotal/kpi/display`).
- **Z-index:** escala de 6 niveles.
- **Faltantes confirmados por ausencia:** no hay escala de *spacing*, ni tokens de `border-radius`, ni de `box-shadow`, ni de *breakpoints* (solo existe `--bw-control-height` como única medida de control).

### PrimeNG y theming

- Preset **Aura** vía `providePrimeNG` (`app.config.ts`), con soporte runtime para Lara/Nora vía `ThemeService.setTheme()` (persistido en `localStorage.appTheme`).
- El **modo oscuro NO usa el mecanismo nativo de PrimeNG** (`darkModeSelector: false`): se implementa manualmente con `body.classList.toggle('dark-theme')` + overrides `!important` en `styles.scss:79-179`. Son dos sistemas de tematización desacoplados, frágiles ante actualizaciones de PrimeNG.

### Componentes reutilizables — inventario de uso real

| Componente | Selector | Usos reales | ¿Realmente compartido? |
|---|---|---|---|
| `bw-phone-input` | `bw-phone-input` | 3 (register, reserva-tab, booking-form-dialog) | Sí, aunque su SCSS ignora el sistema de tokens (100% hex hardcodeado) |
| `bw-patient-card` | `bw-patient-card` | 2 (reserva-tab, booking-form-dialog) | Sí, pero es el componente compartido más grande del repo |
| `bw-toast-modal` | `bw-toast-modal` | **0** — nunca instanciado en ningún template | **No — código muerto** |
| `ToastService` | — | 1 uso (`provider-availability.component.ts`) | No — su único consumidor invoca un servicio cuyo componente de render no está montado en ninguna parte, por lo que sus mensajes de éxito/error **no llegan a mostrarse al usuario** |

### Duplicación de patrones de UI (Hecho)

- **8+ implementaciones paralelas de skeleton/loading**, cada una con su propio naming (`list-skeleton`, `cal-header-skeleton`, `bfd-skeleton`, `btd-skeleton`, `bd-skeleton`, `sale-skeleton`, `avail-skeleton`, `dash-sk-stat`) en vez de un componente compartido.
- **2 convenciones distintas de empty-state** conviviendo: filas de tabla `"No se encontraron X"` vs. bloques con ícono `.empty-state`.
- **Ningún `ConfirmationService`/`p-confirmDialog` reutilizable** — la única confirmación destructiva de todo el sistema es un `window.confirm()` nativo del navegador (`booking-dialog.component.ts:277`), y la eliminación de bloqueos de horario (`block-time-dialog.component.ts:398`) no tiene ninguna confirmación.
- **Sistema de toasts duplicado**: `MessageService`/`p-toast` de PrimeNG (activo, 7 archivos) + `ToastService`/`ToastModalComponent` propio (código muerto, ver arriba).

### Colores hardcodeados fuera del sistema de tokens (Hecho)

Solo 7 de 22 hojas `.scss` de la app referencian variables `--bw-*`/`--color-*`. Ejemplos de colores huérfanos, ajenos a la paleta de marca:
- `#9333ea` (morado) duplicado en `block-time-dialog.component.scss:209` y `booking-form-dialog.component.scss:368`.
- `linear-gradient(135deg, #667eea, #764ba2)` (paleta púrpura/violeta) en `register.component.scss:6`, `_auth-shared.scss:6` y `admin-dashboard.component.scss:36` — no relacionada con el navy/azul de marca.
- `phone-input.component.scss` es 100% hardcodeado (grises tipo Tailwind: `#d1d5db`, `#374151`, `#3b82f6`), cero variables CSS.
- Bloques de configuración de FullCalendar duplicados casi literalmente entre `full-calendar.component.scss` y `provider-calendar.component.scss`.

### Estados de interacción faltantes

`phone-input.component.scss` (reutilizado 3 veces) define `:focus` pero **ningún estado `:disabled`**. `patient-card.component.scss` (el componente compartido más complejo) no define ningún `:focus` propio. `providers-list.component.scss` y `provider-availability.component.scss` no tienen `:hover`/`:focus`/`:disabled` en absoluto.

---

## 9. Evaluación de usabilidad

Se evaluó contra heurísticas de Nielsen. Aclaración: hallazgos basados en lectura estática de código, no en pruebas con usuarios reales.

| Pantalla/Componente | Evidencia | Impacto | Severidad | Recomendación inicial |
|---|---|---|---|---|
| `clients-list.component.html`, `providers-list.component.html`, `locations-list.component.html`, `packs-list.component.html` | Botones "Editar"/"Ver"/"Ver Packs"/"Ver Agenda" sin `(click)` ni método asociado en el `.ts` | El usuario cree que puede gestionar estos recursos y no puede — callejón sin salida | **Bloqueante** | Implementar la funcionalidad real o, si no es prioridad de esta fase, ocultar/deshabilitar visualmente los botones para no prometer algo que no existe |
| `block-time-dialog.component.ts:398` | Eliminar un bloqueo de horario no pide confirmación | Borrado accidental irreversible de un bloqueo de agenda | **Alto** | Agregar confirmación (idealmente con un `ConfirmationService` reutilizable, ver §14) |
| `validation-translator.ts:98` | Fallback retorna el mensaje de Laravel sin traducir si no coincide con los ~25 patrones cubiertos | El usuario puede ver un mensaje técnico en inglés en medio de una UI en español | **Alto** | Añadir un mensaje genérico de fallback en español en vez de reenviar el texto crudo del backend |
| `register.component.html:5`, `provider-layout.component.html:6` | Texto literal `"Kinesilk"` como nombre de marca, mientras el resto de la app dice `"Bookwise"` | Confusión de marca, parece un error de copy-paste de un rebrand anterior | **Medio** | Unificar el nombre de producto en todas las pantallas |
| `admin-layout.component.html` vs `provider-layout.component.html` | Sidebar oscuro colapsable con dark mode vs. menubar superior simple sin dark mode | Los dos roles principales del sistema tienen experiencias de navegación estructuralmente distintas | **Medio** | Evaluar si la divergencia es intencional (simplicidad para provider) o deuda de no haber unificado el layout |
| `booking-dialog.component.ts:277` | `confirm()` nativo del navegador para cancelar una reserva, en vez de un diálogo con estilo de marca | Rompe la consistencia visual justo en la acción más destructiva del sistema | **Bajo-Medio** | Reemplazar por un modal de confirmación propio |
| `patient-card.component.html:216-219` | Estado de reserva mostrado **solo** con un punto de color, sin texto ni ícono | Usuarios con daltonismo o baja visión no perciben el estado | **Medio** | Acompañar el punto de color con texto o ícono (ya se hace bien en `full-calendar` con `p-tag`, replicar ese patrón) |
| Listas de admin (`clients`, `providers`, `locations`, `packs`) | Solo `clients-list` tiene paginación; el resto no | Inconsistencia de eficiencia entre pantallas similares | **Bajo** | Unificar paginación en las 4 listas |
| `admin-dashboard.component.ts:88-105` | Gráficos con datos hardcodeados desconectados de los datos reales ya cargados | El admin puede tomar decisiones basado en números que no reflejan la realidad | **Alto** | Conectar los gráficos a los datos reales o remover temporalmente si no están listos |
| `payment-detail-dialog.component.html` | Tabs "recordatorios"/"ficha médica"/"historial" con texto "próximamente" | Expectativa de funcionalidad no cumplida | **Medio** | Ocultar las pestañas hasta que estén implementadas, o marcarlas explícitamente como "en desarrollo" de forma más visible |
| Diálogos de reservas (`booking-form-dialog`, `block-time-dialog`, `payment-tab`) | Sí usan `[loading]` en botones de guardar de forma consistente | — | — (positivo) | Mantener el patrón al construir nuevas pantallas |
| `HttpErrorService` | Maneja 3 categorías de error (negocio/validación/framework) con traducción propia, nunca expone `body.detail` crudo (salvo el fallback ya mencionado) | — | — (positivo, con la excepción de §validación) | Cerrar el hueco del fallback en inglés |

**Terminología mixta ES/EN** confirmada en encabezados de tabla y tarjetas ("Locations" en `providers-list.component.html:24`, `locations-list.component.html:1`, `admin-dashboard.component.html:27`) — severidad **Baja**, pero afecta la percepción de pulido del producto.

---

## 10. Evaluación inicial de accesibilidad

**Esto es una revisión inicial basada en lectura estática de código. No se certifica cumplimiento de WCAG 2.2 en ningún nivel — se requieren pruebas con herramientas de contraste reales y con lectores de pantalla para una evaluación completa.**

| Criterio WCAG | Hallazgo | Evidencia | Severidad |
|---|---|---|---|
| Navegación por teclado | El menú contextual flotante del calendario (slot menu) es un `<div>` casero sin manejador de `Escape`/`keydown` | `full-calendar.component.html:339-362`, `provider-calendar.component.html:202-227` | Medio |
| Foco visible | `outline: none` sin reemplazo confirmado en `.iti__search-input` (depende de la librería externa, no verificable estáticamente) | `phone-input.component.scss:64` | Bajo (No verificado el comportamiento real) |
| Etiquetas de formulario | `<label>` sin atributo `for`, inputs sin `id` correspondiente | `provider-availability.component.html:96-105` | Medio |
| Asociación error-campo | Mensajes de error visuales sin `aria-describedby`/`aria-invalid` | `register.component.html`, `booking-form-dialog.component.html` (múltiples líneas) | Medio |
| Uso semántico de encabezados | Jerarquía inconsistente: `register.component.html` usa `<h1>` para el nombre de marca, no para el título de página; `login.component.html` usa `<h2>` sin `<h1>` previo | `register.component.html:5`, `login.component.html:30` | Bajo-Medio |
| Texto alternativo | Las 3 únicas `<img>` del proyecto tienen `alt` | `login.component.html:6`, `admin-layout.component.html:18,21` | — (positivo) |
| Contraste | Pares sospechosos no medidos con herramienta real: texto blanco a 70-75% de opacidad sobre gradiente de marca | `login.component.scss:67,84` | No verificado |
| Uso del color | Estado de reserva comunicado solo por color en un componente (ver §9); correctamente combinado con texto en otro (`p-tag`) | `patient-card.component.html:216-219` vs `full-calendar.component.html:280-286` | Medio |
| Tamaño de áreas interactivas | Botones `size="small"` en acciones destructivas podrían reducir el área táctil por debajo de referencias típicas | `block-time-dialog.component.html:13`, varios en `payment-tab` | No verificado (requiere medición DOM real) |
| Modales y gestión de foco | Todos los `p-dialog` usan el comportamiento por defecto de PrimeNG (focus trap incluido); el único elemento "modal" no estándar (slot menu) no tiene gestión de foco propia | — | Medio (acotado al slot menu) |
| Autocompletado | Cero atributos `autocomplete` en los formularios de login/registro | `login.component.html`, `register.component.html` | Bajo |
| Mensajes de estado (aria-live) | `p-toast` de PrimeNG probablemente aporta `aria-live` por comportamiento estándar de la librería (no verificado en DOM renderizado); el componente propio `ToastModalComponent` no declara ningún `aria-live`/`role` explícito, pero además está sin usar en ningún template | `toast-modal.component.ts` | Bajo (dado que el componente ni siquiera se renderiza) |
| Controles personalizados | El slot menu del calendario es el único control totalmente custom fuera de PrimeNG; el resto del sistema delega en los controles accesibles de PrimeNG | — | Medio |

---

## 11. Estado responsive

**Hecho.** Se usan 8 valores de breakpoint distintos a lo largo del proyecto (`374px`, `375px`, `425px`, `640px`, `768px`, `991px`, `992px`, `1024px`), **sin ninguna variable o mixin SCSS compartido** para definirlos. Inconsistencias concretas:

- `admin-layout.component.scss` usa el par `991px`/`992px` mientras el resto del proyecto usa `768px`.
- `full-calendar.component.scss` y `provider-calendar.component.scss` (componentes casi gemelos) usan `374px`, mientras `booking-form-dialog.component.scss` usa `375px` — diferencia de 1px que evidencia copy-paste sin sincronizar.
- No existe archivo de utilidades de layout/grid; el 100% del layout responsive se resuelve ad-hoc por componente (29 usos de `display: grid`, 20 archivos con `display: flex`, sin mixins compartidos).
- **No verificado**: comportamiento real de reflow/zoom en dispositivos o viewports concretos — esta evaluación es solo de código fuente, no de renderizado real.

---

## 12. Estado de pruebas

**Hecho, ejecutado realmente en esta auditoría:**

```
Test Files  4 passed (4)
     Tests  98 passed (98)
  Duration  35.12s
```

| Archivo | Qué cubre |
|---|---|
| `app.spec.ts` | Smoke test de creación del componente raíz |
| `client-similarity.util.spec.ts` | Normalización de texto, matching por email/teléfono/nombre, deduplicación |
| `patient-card.component.spec.ts` | Iniciales, warnings de contacto incompleto, `whatsappHref`, tabs lazy, badges, outputs |
| `booking-form-dialog.component.spec.ts` (~745 líneas, el más extenso) | Toggling de paneles, reset de formulario, validador de RUT, pre-check de pacientes similares con debounce, teardown en `ngOnDestroy` |

**Cobertura real:** 4 archivos de test sobre ~50+ componentes/servicios del proyecto — la cobertura es alta en calidad puntual (los tests existentes son sustanciosos, no triviales) pero muy baja en amplitud. No hay tests para: `ApiService`, `AuthService`, guards, interceptores, `AvailabilityService`, ni para ninguna de las pantallas de listado admin (locations/providers/packs/clients), ni para el flujo de pago/venta. **No hay tests E2E** (no se encontró Cypress/Playwright/Protractor en el proyecto).

---

## 13. Riesgos técnicos

Clasificados Bloqueante / Alto / Medio / Bajo.

### Bloqueantes

- **Build de producción falla.** `ng build --configuration production` termina en error: `patient-card.component.scss` (8.12KB, supera por 115 bytes el límite de error de 8KB), `provider-calendar.component.scss` (9.96KB, supera por 1.96KB), `full-calendar.component.scss` (12.82KB, supera por 4.82KB). Además, el bundle JS inicial (800.17KB) supera el *warning* de 500KB (no bloquea, pero está lejos del objetivo).
- **`environment.prod.ts` nunca se usa** — sin `fileReplacements` en `angular.json`, cualquier build de producción seguiría apuntando a `http://127.0.0.1:9999/api/v1`.
- **11MB de un ZIP de fuentes (`Fira_Code,Roboto.zip`) + 22MB de la carpeta `fonts/`** se copian al build de producción por un glob `"input": "src/assets"` sin exclusiones en `angular.json:26-34` — peso muerto significativo sobre un bundle que ya excede presupuesto.

### Altos

- **Token de sesión y objeto de usuario completo en `localStorage` sin cifrar** (`auth_token`, `auth_user`) — vector clásico de exfiltración vía XSS si algún día se introduce una vulnerabilidad de ese tipo.
- **7 vulnerabilidades de `npm audit`** (6 altas, 1 moderada) en el árbol `@angular/*` — incluyen DoS por OOM, fuga de información en `HttpTransferCache`, hashing débil de 32 bits, y bypass de sanitización XSS en two-way binding. **Todas tienen fix disponible dentro del propio rango `^21.1.0`** (parche de `21.2.10` a `21.2.17`), sin necesidad de subir de major.
- **46 llamadas `.subscribe()` en 17 archivos, solo 2 con `takeUntilDestroyed`**, cero uso de `Subscription`/`.unsubscribe()` en código de producción — riesgo real de fugas de memoria y actualizaciones de estado en componentes ya destruidos (condiciones de carrera), especialmente en diálogos que se abren/cierran repetidamente (`booking-form-dialog`, `block-time-dialog`, `booking-dialog`, `payment-tab`).
- **Todos los endpoints de registro, ventas/transacciones y `PATCH` de bloqueos de horario no existen en el backend** (ver §7) — funcionalidad de frontend que no puede completarse en ningún ambiente hasta que el backend los implemente.
- **`AvailabilityService` 100% simulado** — cualquier decisión de disponibilidad tomada en esa pantalla no tiene efecto real ni valida colisiones de verdad.
- **`logout()` no revoca el token en el servidor** — el token Sanctum permanece válido tras "cerrar sesión" en el cliente.

### Medios

- **76% de los componentes (16/21) sin `ChangeDetectionStrategy.OnPush`**, incluyendo los 4 componentes más grandes y complejos del sistema.
- Todo el árbol Angular desactualizado incluso dentro de su propio rango semver (`21.2.10` instalado vs `21.2.17` disponible, que es justamente el patch que resuelve las vulnerabilidades).
- **Sin `ErrorHandler` global** — errores no controlados en producción no tienen ninguna visibilidad centralizada (ni consola remota, ni Sentry, ni similar).
- **Mismatch sistémico de forma de respuesta** entre el backend paginado (`{data, links, meta}`) y el tipado optimista del frontend (arrays/objetos planos) en al menos 5 endpoints — TypeScript no detecta el error porque los tipos son declarados manualmente, no inferidos de un contrato compartido.

### Bajos

- Sin linter configurado (sin ESLint, sin script `lint`).
- Sin Storybook, sin Dockerfile, sin CI/CD.
- Imágenes sin optimizar en `src/assets/images` (`Bookwise logo.png` de 798KB, íconos duplicados con nombres anómalos como `icono (1).svg`).
- Sin `NgOptimizedImage` (impacto real bajo por ahora, solo 3 `<img>` en todo el proyecto).

---

## 14. Preparación para producción

**Estado actual: NO apto para producción.** Motivos concretos, en orden de bloqueo:

1. El build de producción no compila.
2. Aunque compilara, apuntaría al backend local del desarrollador, no a un backend real.
3. Tres flujos de negocio centrales (registro, cobro, reprogramación de bloqueos) no pueden completarse porque el backend no los soporta.
4. La gestión administrativa de 3 de los 4 catálogos principales (sedes, profesionales, packs) es de solo lectura, contradiciendo lo que la interfaz sugiere visualmente.
5. No hay pipeline de CI/CD, ni Dockerfile, ni proceso de despliegue documentado y verificable — el README solo cubre `npm install && ng serve` para desarrollo local.
6. No hay monitoreo de errores en producción (sin `ErrorHandler` global, sin integración con ninguna herramienta de observabilidad).

Lo que **sí** está en buen estado para construir sobre ello: la arquitectura de rutas/lazy-loading, el manejo centralizado de errores HTTP (con la salvedad del fallback de traducción), el sistema de tokens de diseño (aunque subutilizado), y el flujo de calendario/reservas, que es funcionalmente sólido.

---

## 15. Recomendaciones priorizadas

1. Arreglar el build de producción (dividir/optimizar los 3 componentes que exceden presupuesto de CSS, o ajustar el presupuesto de forma consciente y documentada).
2. Configurar `fileReplacements` en `angular.json` para que `environment.prod.ts` se use realmente en producción.
3. Excluir `Fira_Code,Roboto.zip` y archivos no necesarios del glob de assets en `angular.json`.
4. Coordinar con el equipo de backend (Bookwise-API / informe de Gepeto) la implementación de: `POST /register`, `POST /sales` + `POST /sales/{id}/transactions`, `PATCH /blocked-slots/{id}`.
5. Decidir el alcance real de Locations/Providers/Packs: implementar CRUD completo o remover la apariencia de editable de la UI mientras tanto.
6. Corregir el mismatch de forma de respuesta paginada vs. plana en `ApiService` (afecta locations, clients, services, providers y bookings).
7. Reemplazar el fallback de `translateValidationMessage` para no mostrar inglés crudo al usuario.
8. Agregar un `ConfirmationService`/`p-confirmDialog` reutilizable y aplicarlo a toda acción destructiva (eliminar bloqueo, cancelar reserva).
9. Actualizar el árbol `@angular/*` al patch más reciente dentro del rango actual (`npm audit fix`) para cerrar las 6 vulnerabilidades altas sin migrar de major.
10. Auditar y agregar `takeUntilDestroyed`/teardown a los 44 `.subscribe()` restantes sin limpieza.
11. Unificar el nombre de marca ("Kinesilk" → "Bookwise") en `register.component.html` y `provider-layout.component.html`.
12. Definir tokens de spacing/radius/shadow/breakpoints y migrar los colores huérfanos (`#9333ea`, `#667eea/#764ba2`) a la paleta de marca.
13. Eliminar el componente `ToastModalComponent`/`ToastService` no utilizado, o conectarlo si se decide mantenerlo, y unificar sobre `MessageService`/`p-toast`.
14. Cerrar las brechas de accesibilidad de mayor severidad: asociación label-input en `provider-availability`, `aria-describedby` en errores de formulario, texto/ícono acompañando el color de estado en `patient-card`.
15. Ampliar cobertura de tests a `ApiService`, `AuthService`, guards e interceptores antes de tocar la lógica de autenticación.

---

## 16. Preguntas abiertas

- ¿Quién y con qué prioridad implementará los endpoints de backend faltantes (registro, ventas/transacciones, `PATCH blocked-slots`)? Esto bloquea directamente 3 flujos de frontend.
- ¿Está previsto un módulo de "cliente final" autenticado, tal como sugiere el README, o esa frase describe una aspiración no vigente del producto?
- ¿El nombre de producto es "Bookwise" o "Kinesilk"? La inconsistencia sugiere un rebrand a medio terminar — se necesita una respuesta oficial antes de tocar esas pantallas.
- ¿Locations, Providers y Packs deben tener CRUD completo en esta fase, o su alcance intencional es de solo lectura por ahora?
- ¿Existe algún acuerdo de versión mínima de Node/npm para el equipo? El `packageManager` declarado (`npm@11.12.1`) no coincide con el disponible en este entorno (9.2.0) — no verificado si esto es relevante para CI/CD futuro.
- ¿Hay un plan u obligación de cumplimiento de accesibilidad (WCAG nivel AA, por ejemplo) exigido por el negocio o por regulación, que determine la prioridad de los hallazgos de accesibilidad?
- ¿El `packageManager: npm@11.12.1` y el rango de Angular 22 disponible implican una decisión ya tomada de actualizar pronto, o se debe fijar el proyecto en Angular 21 por más tiempo?

---

## 17. Propuesta de siguiente fase

Orden sugerido — **no ejecutar sin autorización explícita**, según lo pedido:

1. **Bloqueantes de ejecución**: arreglar presupuesto de CSS de producción; configurar `fileReplacements`; limpiar el glob de assets.
2. **Bloqueantes de integración**: coordinar con backend la implementación de `/register`, `/sales(+transactions)`, `PATCH /blocked-slots/{id}`; corregir el mismatch de shape de respuestas paginadas.
3. **Correcciones funcionales**: decidir y resolver el alcance de Locations/Providers/Packs (CRUD real u ocultar acciones); conectar o remover los gráficos hardcodeados del dashboard; revisar los tabs placeholder de pago.
4. **Correcciones de accesibilidad**: asociación label-input, `aria-describedby` en errores, texto/ícono junto al color de estado, `autocomplete` en formularios de auth.
5. **Correcciones de seguridad**: `npm audit fix` dentro del rango actual; evaluar migrar el token de `localStorage` a un mecanismo más seguro (o al menos documentar el riesgo aceptado); revocar token en logout.
6. **Unificación de componentes**: `ConfirmationService` reutilizable, un solo sistema de toasts, un componente de skeleton/empty-state compartido, unificación de marca ("Kinesilk"/"Bookwise").
7. **Pruebas**: ampliar cobertura a servicios core (`ApiService`, `AuthService`, guards, interceptores) y a los flujos de listados admin; evaluar incorporar tests E2E para el flujo de calendario.
8. **Optimización**: `OnPush` en los componentes más pesados, limpieza de suscripciones (`takeUntilDestroyed`), actualización del árbol Angular al último patch.
9. **Configuración de producción**: definir variables de entorno reales por ambiente, documentar el proceso de build/deploy.
10. **Despliegue**: definir Dockerfile/pipeline de CI-CD (actualmente inexistentes).
11. **Validación posterior al despliegue**: smoke tests de los flujos críticos (login, calendario, cobro) contra el ambiente real antes de considerar el lanzamiento completo.

---

## Tabla final de hallazgos

| ID | Hallazgo | Severidad | Evidencia | Impacto | Recomendación |
|----|----------|-----------|-----------|---------|---------------|
| H01 | Build de producción falla por presupuesto de CSS excedido en 3 componentes | Bloqueante | `ng build --configuration production` → `Application bundle generation failed`; `patient-card.component.scss` +115B, `provider-calendar.component.scss` +1.96KB, `full-calendar.component.scss` +4.82KB sobre el límite de 8KB | No se puede generar un artefacto de producción | Reducir/dividir CSS de esos 3 componentes o ajustar presupuesto conscientemente |
| H02 | `environment.prod.ts` nunca se usa — sin `fileReplacements` en `angular.json` | Bloqueante | `angular.json` sin ninguna coincidencia de "environment"; `api.service.ts:4` importa `@env/environment` que resuelve siempre a `environment.ts` (dev) | Un build de producción llamaría al localhost del desarrollador | Configurar `fileReplacements` por configuración de build |
| H03 | Endpoint de registro (`POST /register`) no existe en el backend | Bloqueante | `routes/api.php` sin ruta de registro; `AuthController` sin método `register` | Nadie puede crear una cuenta nueva en producción | Implementar el endpoint en Bookwise-API o remover el flujo del frontend hasta que exista |
| H04 | Botones de Editar/Ver en Clientes, Profesionales, Sedes y Packs sin `(click)` | Bloqueante | `clients-list.component.html:59-64`, `providers-list.component.html:47-48`, `locations-list.component.html:38-39`, `packs-list.component.html:41-42` | Gestión administrativa de estos 4 catálogos no funciona pese a apariencia de UI completa | Implementar la funcionalidad o retirar visualmente los botones |
| H05 | Módulo de ventas/pagos (`POST /sales`, `/sales/{id}/transactions`) sin backend | Bloqueante | `routes/api.php` solo define `GET /sales`, `GET /sales/{id}` | No se puede cobrar ni registrar abonos de una reserva | Priorizar implementación backend de ventas/transacciones |
| H06 | `PATCH /blocked-slots/{id}` (drag&drop de bloqueos) no existe en backend | Bloqueante | `routes/api.php:98-105` solo define GET/POST/DELETE; usado en `full-calendar.component.ts:535`, `provider-calendar.component.ts:466`, `block-time-dialog.component.ts:378` | Reprogramar un bloqueo de horario arrastrándolo falla en ambos calendarios (admin y provider) | Implementar el `PATCH` en backend |
| H07 | Mismatch sistémico de forma de respuesta (paginado vs. plano) | Alto | Respuestas reales `{data, links, meta}` en Locations/Clients/Services/Providers; frontend tipa `Observable<Location[]>` etc. (`api.service.ts`, `locations-list.component.ts:33-36`) | Listas pueden mostrarse vacías/con `undefined` en runtime pese a compilar sin error | Alinear tipos de `ApiService` con la forma real de respuesta de Laravel |
| H08 | Token de sesión y usuario completo en `localStorage` sin cifrar | Alto | `auth.service.ts:9-10,42,49` — `TOKEN_KEY='auth_token'`, `USER_KEY='auth_user'` | Vector de exfiltración de sesión vía XSS | Evaluar `httpOnly` cookie o al menos documentar el riesgo aceptado |
| H09 | 7 vulnerabilidades npm (6 altas) en `@angular/*`, fix disponible sin cambio de major | Alto | `npm audit --production`: DoS, fuga en `HttpTransferCache`, bypass de sanitización XSS | Exposición a vulnerabilidades conocidas y documentadas públicamente | `npm audit fix` / bump de patch a `21.2.17` |
| H10 | 46 `.subscribe()` sin teardown en 17 archivos, solo 2 con `takeUntilDestroyed` | Alto | Conteo por archivo vía grep; cero uso de `Subscription`/`.unsubscribe()` en producción | Fugas de memoria y actualizaciones de estado en componentes destruidos (condiciones de carrera) | Adoptar `takeUntilDestroyed` de forma sistemática |
| H11 | ZIP de fuentes de 11MB + 22MB de `fonts/` copiados al build de producción | Alto | `angular.json:26-34`, glob `"input": "src/assets"` sin exclusión; `Fira_Code,Roboto.zip` | Peso muerto en el bundle de producción, ya en rojo de presupuesto | Excluir el ZIP y archivos no usados del glob de assets |
| H12 | `AvailabilityService` 100% simulado (mock, TODOs, `Math.random()`, colisión siempre `false`) | Alto | `availability.service.ts` líneas 37, 53, 65, 73-81 | Disponibilidad de providers no persiste ni valida colisiones reales | Implementar backend real de disponibilidad antes de habilitar la pantalla en producción |
| H13 | `logout()` no revoca el token en el servidor | Alto | `auth.service.ts:69-77` solo limpia `localStorage`, nunca llama `POST /auth/logout` (que sí existe en backend) | Token Sanctum sigue válido tras "cerrar sesión" | Invocar el endpoint de logout del backend antes de limpiar el estado local |
| H14 | Sin `ConfirmationService`/diálogo de confirmación reutilizable; solo `window.confirm()` nativo | Alto | `booking-dialog.component.ts:277` (único uso); `block-time-dialog.component.ts:398` sin ninguna confirmación | Borrado accidental de bloqueos de horario; inconsistencia visual en la acción más destructiva del sistema | Introducir `ConfirmationService`/`p-confirmDialog` de PrimeNG de forma transversal |
| H15 | Fallback de traducción de errores de validación puede mostrar inglés crudo | Alto | `validation-translator.ts:98`, `return message` sin traducir si no matchea los ~25 patrones | Mensajes técnicos en idioma incorrecto llegan al usuario final | Agregar mensaje de fallback genérico en español |
| H16 | Marca inconsistente "Kinesilk" vs "Bookwise" | Medio | `register.component.html:5`, `provider-layout.component.html:6` | Confusión de identidad de marca para el usuario | Unificar el naming de producto en toda la app |
| H17 | Posible mismatch de scopes por rol (`provider` sin `clients:write`) | Medio (Inferencia, no verificado end-to-end) | `UserRole::tokenAbilities()` en backend vs. `reserva-tab.component.ts:171` en frontend | Edición de cliente por un provider podría fallar con 403 en runtime | Verificar en runtime autenticado y alinear permisos frontend/backend |
| H18 | 76% de componentes sin `ChangeDetectionStrategy.OnPush` | Medio | Conteo: 5/21 archivos `*.component.ts` con OnPush | Rendimiento subóptimo en los componentes más pesados (`full-calendar`, `booking-form-dialog`) | Migrar los componentes grandes a OnPush progresivamente |
| H19 | Árbol Angular desactualizado dentro de su propio rango semver | Medio | `npm outdated`: `21.2.10` instalado vs `21.2.17` wanted (el patch que resuelve H09) | Vulnerabilidades conocidas sin parchear innecesariamente | Actualizar dentro del caret actual |
| H20 | Sin `ErrorHandler` global | Medio | grep negativo de `implements ErrorHandler`/`provideErrorHandler` | Errores no controlados en producción sin visibilidad centralizada | Implementar `ErrorHandler` custom + integración con herramienta de observabilidad |
| H21 | Layouts admin/provider estructuralmente distintos | Medio | `admin-layout.component.html` (sidebar) vs `provider-layout.component.html` (menubar) | Experiencia de navegación inconsistente entre roles | Definir si es intencional; si no, unificar patrón de navegación |
| H22 | Sistema de toasts duplicado, uno de ellos código muerto | Medio | `ToastModalComponent`/`ToastService` nunca renderizado; usado solo en `provider-availability.component.ts` | Mensajes de éxito/error en disponibilidad de provider no llegan a mostrarse al usuario | Eliminar el sistema muerto o conectarlo; unificar sobre `MessageService`/`p-toast` |
| H23 | Sistema de tokens de diseño subutilizado; colores huérfanos fuera de paleta | Medio | Solo 7/22 `.scss` referencian tokens; `#9333ea`, `#667eea/#764ba2` en múltiples archivos | Inconsistencia visual y dificultad de mantenimiento del sistema de diseño | Migrar colores huérfanos a tokens; agregar spacing/radius/shadow/breakpoints como tokens |
| H24 | Estado de reserva comunicado solo por color en `patient-card` | Medio | `patient-card.component.html:216-219`, sin texto/ícono acompañante | Usuarios con daltonismo/baja visión no perciben el estado | Acompañar el color con texto o ícono, como ya se hace en `full-calendar` |
| H25 | Sin `aria-describedby`/`aria-invalid` en errores de formulario; labels sin `for`/`id` | Medio | `register.component.html`, `booking-form-dialog.component.html`, `provider-availability.component.html:96-105` | Lectores de pantalla no anuncian automáticamente los errores de validación | Asociar programáticamente errores con sus campos |
| H26 | Breakpoints responsive inconsistentes sin variable/mixin compartido | Medio | 8 valores distintos (`374/375/425/640/768/991/992/1024px`) en distintos archivos | Comportamiento responsive impredecible entre pantallas similares | Definir breakpoints como variables SCSS compartidas |
| H27 | Patrones de UI duplicados manualmente (8+ skeletons, 2 convenciones de empty-state) | Medio | Ver §8 | Mantenimiento costoso, riesgo de divergencia visual futura | Extraer componentes compartidos de skeleton y empty-state |
| H28 | Dashboard con gráficos de datos fijos desconectados de datos reales | Alto | `admin-dashboard.component.ts:88-105` | El admin puede tomar decisiones sobre datos que no reflejan la realidad | Conectar los gráficos a los datos ya cargados en `loadData()` o removerlos temporalmente |
| H29 | Tabs "recordatorios"/"ficha médica"/"historial" son placeholders sin funcionalidad | Medio | `payment-detail-dialog.component.html`, texto "próximamente" | Expectativa de funcionalidad incumplida para el usuario | Ocultar hasta implementación real o etiquetar más claramente como "en desarrollo" |
| H30 | Locations/Providers/Packs sin CRUD ni en frontend ni en backend (solo lectura) | Alto | `ApiService` carece de create/update/delete para estos 3 recursos | Brecha de gestión administrativa más amplia de lo que sugiere la UI | Definir alcance real y, si corresponde, implementar CRUD completo |
| H31 | Sin `autocomplete` en formularios de login/registro | Bajo | grep negativo en `login.component.html`, `register.component.html` | Peor experiencia con gestores de contraseñas/autocompletado del navegador | Agregar `autocomplete="email"`, `current-password`, `new-password`, `tel`, `name` según corresponda |
| H32 | Terminología mixta ES/EN en encabezados y aria-labels | Bajo | `"Locations"` en varias pantallas; `aria-label="Edit patient"` en `patient-card.component.html:37` | Percepción de falta de pulido en una app en español | Unificar idioma de toda la interfaz |
| H33 | Imágenes sin optimizar/duplicadas en `src/assets/images` | Bajo | `Bookwise logo.png` 798KB, íconos duplicados (`icono.png`, `icono1.ico`, `icono.ico`, `icono (1).svg`) | Peso innecesario en el bundle de assets | Optimizar/comprimir imágenes, remover duplicados |
| H34 | Sin `NgOptimizedImage` | Bajo | grep negativo, solo 3 `<img>` en el proyecto | Impacto real bajo hoy, relevante si crece el uso de imágenes | Adoptar `NgOptimizedImage` al agregar nuevas imágenes |
| H35 | Sin linter (ESLint) configurado | Bajo | Sin script `lint`, sin `.eslintrc*`/`eslint.config.*` | Sin barrera automática de calidad de código antes de esta auditoría | Configurar ESLint con reglas Angular antes de escalar el equipo |
| H36 | Sin Storybook, Dockerfile ni CI/CD | Bajo | Búsqueda exhaustiva sin resultados | Sin proceso reproducible de build/deploy ni documentación viva de componentes | Definir estos elementos en la fase de preparación para despliegue (ver §17, puntos 9-10) |

---

## Resumen para el jefe de proyecto (máximo 10 puntos)

1. **El build de producción no compila hoy** (presupuesto de CSS excedido en 3 componentes) — es el primer bloqueante a resolver.
2. **Aunque compilara, apuntaría al servidor local del desarrollador**, no a un backend real: falta configurar el reemplazo de archivo de entorno en `angular.json`.
3. **Tres flujos de negocio están rotos por falta de endpoints en el backend**: registro de usuarios, cobro/pagos de una reserva, y reprogramación de bloqueos de horario por arrastre.
4. **La gestión de Clientes, Profesionales, Sedes y Packs es de solo lectura** pese a que la interfaz muestra botones de edición que no hacen nada — esto necesita una decisión de producto (¿se implementa o se oculta?).
5. El **calendario de reservas es el flujo más maduro y funcional** del sistema — es la base sólida sobre la que construir.
6. Hay **riesgos de seguridad concretos y accionables**: 6 vulnerabilidades npm altas con parche disponible sin romper nada (actualización de patch), y el token de sesión guardado sin cifrar en el navegador.
7. El **sistema de disponibilidad de profesionales es completamente simulado** (datos ficticios, sin persistencia real) — no debería presentarse como funcional a usuarios finales todavía.
8. **No existe ningún pipeline de CI/CD, Dockerfile ni linter configurado** — el proyecto no tiene aún un camino de despliegue reproducible.
9. Se detectó una **inconsistencia de marca** ("Kinesilk" en dos pantallas vs. "Bookwise" en el resto) que sugiere un rebrand incompleto y requiere una decisión explícita.
10. La **accesibilidad y el sistema de diseño están documentados pero subutilizados**: hay una base de tokens de marca bien pensada, pero gran parte del código no la usa, y hay brechas de accesibilidad concretas (asociación de errores a campos, uso exclusivo de color para transmitir estado) que conviene resolver antes de escalar la base de usuarios.
