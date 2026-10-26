# Datos de facturación + hub con sidebar

Menú de facturación con navegación lateral (referencia visual: AgendaPro) y una sección
nueva de **Datos de facturación** con los datos fiscales chilenos del pagador.

## Estado (2026-10-26) — DESBLOQUEADO: backend listo, frontend EN CURSO

**Backend verificado en `develop` @ `8a76c94`** (merge de `feat/account-billing-data`).
Contrato escrito en `Bookwise-API/docs/api/billing-frontend.md` §9. Frontend: **0 %**
(no hay modelo fiscal, ni `accounts-api`, ni `sii-activities-api`, ni ruta `datos`).

Superficie: **el hub `/admin/facturacion`**, no `/admin/negocios/:id` (ver S9).
Alcance de esta entrega: pantalla fiscal **+ sidebar agrupado Pago/Plan** (S10).

## Specs

- S1 (usuario, referencia visual `datos de facturacion.png`): el hub de facturación tiene
  que tener un menú lateral claro, agrupado en **Pago** y **Plan**, con la sección
  **Datos de facturación**.
- S2 (usuario): los datos fiscales se piden al pagador con los campos chilenos de la
  referencia: tipo de contribuyente, RUT, razón social, giro, dirección, región, comuna,
  teléfono y email.
- S3 (usuario, decisión): los datos fiscales viven en la **cuenta**, no en el negocio.
  "creo que debe ser en la cuenta porque lo de multitenant es en modo de servicio".
- S4 (usuario, decisión): el giro usa el **catálogo SII completo**, no texto libre.
- S5 (usuario, decisión): **dos** tipos de contribuyente (`company` | `individual`).
- S6 (usuario, instrucción): "cuando hayan campos de telefono utilizamos la libreria que
  ya tenemos en algunos formularios" → `bw-phone-input`.
- S7 (usuario, decisión): **sin** selector "a qué empresa facturar" por ahora; solo queda
  registrado el requisito de `billed_tenant_id`.
- S8 (usuario, decisión): RUT **sin** constraint de unicidad entre cuentas.
- S9 (usuario, esta sesión): "quizá estoy confundiendo porque tu me hablas de
  admin/negocios/:id" → la pantalla fiscal **no** es el editor de negocio; vive en el hub
  de facturación y edita la **cuenta**, no el tenant.
- S10 (usuario, decisión de alcance): "Pantalla + sidebar AgendaPro" → esta entrega
  incluye el sidebar agrupado en **Pago** y **Plan**, no solo el formulario.

## Contrato backend — CERRADO

Verificado contra el código de `Bookwise-API` por el agente de backend.

### Campos nuevos sobre `accounts`

| Columna | Tipo | Nullable | Uso |
|---|---|---|---|
| `rut` | string(20) | sí | RUT fiscal de la cuenta (editable, módulo 11, **sin unique**) |
| `taxpayer_type` | string(20) enum | sí | `company` \| `individual` |
| `legal_name` | string(255) | sí | razón social completa (fiscal) |
| `sii_activity_id` | FK `sii_activities` | sí | giro |
| `billing_address` | string(255) | sí | dirección de facturación |
| `billing_region_id` | FK `regions` | sí | región |
| `billing_comuna_id` | FK `comunas` | sí | comuna (validada contra la región) |
| `billing_phone` | string(40) | sí | teléfono (E.164) |

`billing_phone` acepta **E.164 tal cual, sin normalizar**. Validación del backend: formato
E.164 genérico `^\+[1-9]\d{6,14}$`, sin restricción de país (sirve para `cl/ar/pe/co/mx`).

Se reusa `accounts.billing_email` (ya existe, no se exponía; ahora sí).

**`accounts.name` ≠ `legal_name`**: `name` es el nombre de display (se completa con el
`business_name` del primer tenant); `legal_name` es la razón social fiscal. Pueden diferir.

### Lectura

El objeto `account` en `GET /v1/accounts` y en `accounts[]` de `/auth/me` agrega:

```json
{
  "rut": "76.123.456-K",
  "taxpayer_type": "company",
  "legal_name": "…",
  "sii_activity": { "id": 123, "code": "960200", "description": "PELUQUERÍA Y OTROS TRATAMIENTOS DE BELLEZA" },
  "billing_email": "…",
  "billing_phone": "+56987524346",
  "billing_address": "…",
  "billing_region_id": 13,
  "billing_comuna_id": 13101
}
```

### Escritura — `PATCH /v1/accounts/{id}`

Autorización: `owner|billing` con membership activa (`canBillAccount`), igual que
`/subscription` y `/payment-methods`.

```json
{
  "rut": "76.123.456-K",
  "taxpayer_type": "company",
  "legal_name": "…",
  "sii_activity_id": 123,
  "billing_email": "…",
  "billing_phone": "+56987524346",
  "billing_address": "…",
  "billing_region_id": 13,
  "billing_comuna_id": 13101
}
```

Se envía `sii_activity_id` (id interno); el resource devuelve el objeto desnormalizado
para que el select renderice la etiqueta sin otro lookup.

**Update parcial**: todos los campos son opcionales. Devuelve
`{ message, data: <mismo objeto account de Lectura> }`. `name` (display) **no** figura en
este PATCH. `taxpayer_type` usa valores en **inglés** (`company`/`individual`): las
etiquetas en español se mapean en i18n. Si `billing_comuna_id` no pertenece a
`billing_region_id` → **422** en `errors.billing_comuna_id`; en update parcial alcanza con
mandar el `billing_region_id` ya guardado. `rut` inválido (módulo 11) → 422.

**Advertencia de RUT duplicado**: no hay constraint, así que el aviso no bloqueante queda
a cargo del frontend.

### Catálogos (públicos, sin token)

- `GET /v1/sii-activities?search=&page=&per_page=` → paginador Laravel
  (`data` + `links` + `meta`). `search` filtra **parcial** y case-insensitive por `code`
  OR `description` (ILIKE `%term%`). `per_page` default **25**, máximo **100**; si se manda
  >100 o inválido → **422** en `errors.per_page`. Ordenado por `code` ascendente.
  Catálogo: **700 códigos** (674 CIIU + 27 de segunda categoría, 1 solapado), fuente
  `sii.cl/catastro/codigos.htm` + `codigos_segunda.htm`, seed idempotente por `code`.
  El código de belleza es **`960200`** ("PELUQUERÍA Y OTROS TRATAMIENTOS DE BELLEZA");
  `960900` no existe en el catálogo.
- `GET /v1/regions` → `{data: [{id, name, timezone}]}`
- `GET /v1/regions/{id}/comunas` → `{data: [{id, name}]}`
- `GET /v1/comunas` → `{data: [{id, name, region_id}]}`

### Requisito diferido

Cuando se cree la tabla `invoices`, **debe** incluir `billed_tenant_id` nullable, para no
cerrar la puerta a facturar a un negocio puntual. Hoy no se crea la tabla: no hay emisión
de DTE y una tabla vacía especulativa es YAGNI.

## Implementación del backend — HECHA Y VERIFICADA

Rama `feat/account-billing-data`, **mergeada a `develop`** (`8a76c94`):

- `7981601` — schema (`accounts` + `sii_activities`) y catálogo seedeado.
- `6493887` — endpoint `GET /v1/sii-activities`.
- `09ea5d4` — lectura del bloque fiscal + `PATCH /v1/accounts/{id}`.
- `982490b` — contrato escrito para el frontend (`docs/api/billing-frontend.md` §9).

**Verificado leyendo el repo (2026-10-26)**:

| Ítem | Evidencia |
|---|---|
| Migración | `database/migrations/core/2026_10_26_114241_add_billing_fields_to_accounts_table.php` — `rut` string(20), `taxpayer_type` string(20), `legal_name` string(255), `sii_activity_id` FK, `billing_address` string(255), `billing_region_id` FK, `billing_comuna_id` FK, `billing_phone` string(40). `rut` sin unique. |
| Rutas | `routes/api.php`: público `GET /regions`, `/comunas`, `/regions/{id}/comunas`, `/sii-activities`; auth `PATCH /accounts/{id}`. |
| PATCH | `AccountController@update` → `canBillAccount()` (owner\|billing + membership activa); `UpdateAccountRequest` con `ChileanRutRule`, `Rule::enum(TaxpayerType)`, `ComunaBelongsToRegion(región efectiva)`, regex E.164 `^\+[1-9]\d{6,14}$`, todos `sometimes\|nullable`. |
| Lectura | `AccountViewService::fiscalPayload()` con `sii_activity` desnormalizado vía `SiiActivityResource` → `{id, code, description}`. Se sirve en `/v1/accounts` **y** en `user.accounts[]` de `/auth/me`. |
| Catálogo | `SiiActivityIndexRequest`: `search` ≤255, `per_page` 1–100 (default 25). 700 códigos, orden por `code`. |
| Ámbito activo | `UserResource` expone `current_account_id` + `accounts[]` (summaries). |
| Tests | `tests/Feature/Postgres/AccountBillingDataTest.php`, `SiiActivityEndpointTest.php`, `AccountEndpointsTest.php`. |

Tests: 21 nuevos (8 del endpoint SII + 13 de PATCH/lectura), verdes, con Postgres + CORE
migrado y seeder real. `invoices` **no** se creó; la migración `2026_10_26_114241`
documenta que la futura tabla debe incluir `billed_tenant_id` nullable.

## Tasks

- ✅ T1 [S3,S9] Modelo: `TaxpayerType`, `SiiActivity`, `AccountBillingData`,
  `AccountSummary`, `AccountTenantSummary`, `UpdateAccountBillingData`;
  `AuthMeData.current_account_id` + `accounts[]`. — HECHO (`src/app/core/models/index.ts`).
- ✅ T2 [S3] `accounts-api.service.ts` (`PATCH /v1/accounts/{id}`) y
  `sii-activities-api.service.ts` (búsqueda server-side con `search`+`per_page`);
  `AuthService.updateAccount()` para reemplazar la cuenta cacheada sin refetch.
  — HECHO (+3 specs de auth, +6 specs de servicios).
- ✅ T3 [S1,S10] Shell del hub con sidebar agrupado (Pago / Plan) por **padres de ruta
  con `router-outlet`**: `AccountSettingsShellComponent` + `AccountSettingsNavComponent`.
  Las URLs no cambiaron. — HECHO (+3 specs de nav, +24 de rutas siguen verdes).
- ✅ T4 [S2,S6] Página "Datos de facturación" en `/admin/facturacion/datos`: banner +
  tres cards, reactive forms, `bw-phone-input`, giro con `p-autocomplete` server-side
  (delay 300 ms), región→comuna dependiente, `rutValidator()`, formulario deshabilitado
  si el rol de cuenta no es `owner`/`billing`. — HECHO (+7 specs).
- ✅ T5 [S2] i18n es/en (nav + fiscal). — HECHO.
- ✅ T6 [S2] Specs + `ng build` verde + `ng test` **711 pass / 6 fail**, los 6
  PREEXISTENTES ajenos (calendar-navigation, historial-reserva ×3, booking-form-dialog ×2).
- ✅ T7 Work-unit commits. — HECHO: `9348e19` (modelo + servicios), `3f7cc5b`
  (pantalla + sidebar), `022cea5` (correcciones de la verificación).

## Verificación independiente (2026-10-26)

`gentle-ai-verify` (read-only, sobre `b71a8d2..HEAD`): **S1-S10 cubiertas**, 63/63 tests
verdes en el alcance autorizado. Hallazgos corregidos en `022cea5`:

1. `account()` caía a `accounts[0]` cuando faltaba `current_account_id`: con 2+ cuentas
   habría mostrado y PATCHeado el perfil fiscal de otra cuenta. Ahora el fallback existe
   solo si el usuario tiene **exactamente una** cuenta; si no, estado "no encontramos la
   cuenta activa".
2. `getAccounts()` era superficie muerta → eliminado.
3. Typo de comentario `COUNTA` → `CUENTA`.

Aceptados y documentados sin implementar: aviso de RUT duplicado (el front no puede saber
si otro RUT existe) y `Preguntas frecuentes` (la sección no existe).

**Suite final**: `ng build` verde · `ng test` **724 pass / 6 fail**, los 6 PREEXISTENTES
y ajenos (calendar-navigation 1, historial-reserva 3, booking-form-dialog 2). Una corrida
anterior dio 10 fallos por flakiness conocida de `providers`/`booking-detail` bajo carga
paralela; la repetida volvió a 6.

### Pendientes conocidos (fuera de alcance, no silenciar)

- **`Preguntas frecuentes`** del sidebar: no existe la sección → no se incluyó (S1).
- **Aviso de RUT duplicado**: el backend no tiene unique, pero el front no puede saber si
  otro RUT existe; no se inventó un chequeo.
- `billing-history` sigue siendo MOCK (falta `GET /v1/invoices`).
- `profile.newBusiness()` y el shortcut "Nuevo negocio" de `/admin/profile` siguen sin
  bloqueo proactivo de cuota (tarea #12).

## Diseño decidido (para no re-explorar)

### Sidebar del hub

Los 6 ítems de la referencia y su ruta actual:

| Ítem | Ruta | Estado |
|---|---|---|
| Pago · Estado de cuenta | `/admin/facturacion` | existe |
| Pago · Historial de pagos | `/admin/facturacion/historial` | existe (**mock**, sin `GET /v1/invoices`) |
| Pago · Datos de facturación | nueva | **a crear** |
| Pago · Preguntas frecuentes | — | no existe → **fuera de alcance por ahora** |
| Plan · Mi plan | `/admin/planes` | existe |
| Plan · Administrar mi plan | `/admin/planes/administrar` | existe |

### Secciones del formulario (calcadas de la referencia)

1. **Información básica** — radio Empresa/Persona natural (`taxpayer_type`), RUT
   (validado módulo 11 en cliente, editable), Razón social (`legal_name`), Giro
   (`sii_activity_id`, `p-select` con búsqueda).
2. **Dirección de facturación** — Dirección (`billing_address`), Región
   (`billing_region_id`), Comuna (`billing_comuna_id`, dependiente de la región).
3. **Datos de contacto** — Teléfono (`billing_phone` con `bw-phone-input`), Email
   (`billing_email`).

Banner superior informativo, como en la referencia.

### `bw-phone-input`

`src/app/shared/components/phone-input/phone-input.component.ts` — standalone,
`ControlValueAccessor` + `Validator`, inputs `placeholder`, `initialCountry='cl'`,
`countryOrder=['cl','ar','pe','co','mx']`, basado en `intl-tel-input ^28.0.4`. Emite
**E.164**. Ya se usa en `auth/register`.

## Log

- L1 (usuario): pasa `datos de facturacion.png` y pide "un menu claro de datos de
  facturacion" para la vista de empresa/negocio.
- L2 (exploración): 5 de los 9 campos ya existen en `Business` (`rut`, `name`, `address`,
  `phone`, `email`); faltan tipo, giro, región y comuna. Los catálogos de región/comuna
  sí existen y son reutilizables.
- L3 (usuario, decisión de superficie): el menú va en **el hub de facturación**, no en
  `/admin/negocios/:id`.
- L4 (análisis): se **rechaza** la propuesta inicial del backend de montar los campos
  sobre `tenants`. `tenants.business_rut` es el RUT del salón ante sus clientes, no la
  identidad fiscal con la que Bookwise lo factura; la suscripción es de la cuenta
  (`Subscription.account_id`) y una cuenta puede tener N negocios.
- L5 (usuario): propone que el cliente pueda elegir a qué empresa facturar por período.
  Análisis entregado: inválido si se implementa como "cambiar el RUT de la factura"
  (documento histórico + DTE va a un RUT concreto). La forma correcta separa **pagador**
  (perfil de cuenta) de **beneficiario por factura** (snapshot por factura, con un perfil
  fiscal completo por entidad). Se difiere hasta que exista emisión real.
- L6 (usuario, decisión): **backend primero**. El frontend espera.
- L7 (usuario, decisión): RUT **sin unique** — bloquearía el re-registro de un cliente que
  canceló, y el RUT no es la identidad de una cuenta Bookwise.
- L8 (corrección propia): dije "reservá la columna `billed_tenant_id`", pero eso asumía que
  la tabla `invoices` existía y no existe. Se pasa a **requisito documentado**.
- L9 (usuario, esta sesión): "continuamos?" → retomar. Eligió el hilo "Vista administrar
  negocio".
- L10 (usuario, corrección de contexto): "quizá estoy confundiendo porque tu me hablas de
  admin/negocios/:id" → aclarado: la referencia es AgendaPro "Datos de facturación"
  (cuenta/pagador) y **no** el editor `business-edit` (`/admin/negocios/:id`). El usuario
  elige la opción **"Pantalla fiscal (AgendaPro)"**.
- L11 (verificación): el agente `Bookwise-API` no tiene estado publicado (`state: null`),
  así que no pudo responder; con autorización explícita se leyó `/home/seba/codingProjects/Bookwise-API`
  (solo lectura) y se confirmó que **todo el contrato está mergeado en `develop`**.
- L12 (usuario, decisión de alcance): "Pantalla + sidebar AgendaPro" → se incluye el
  sidebar agrupado en esta entrega (no se difiere).
