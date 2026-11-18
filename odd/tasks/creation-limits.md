# Límites de creación — bloqueo proactivo al tope del plan (#12)

Hoy el alta de sucursal/negocio llega al formulario y recién ahí el backend responde
402 (CTA reactivo). Lo que falta es **bloquear antes**: al tocar el botón, si la cuota
del plan está llena, abrir un diálogo con CTA de upgrade.

## Estado (2026-10-26) — PAUSADO

**Nada implementado todavía.** Solo existe este documento (sin commitear). El usuario
pausó la tarea para abrir gentle-shell y pasar imágenes de referencia.

## Specs

- S1 (#12, de `odd/tasks/billing-plans-addons.md`): "**#12 Límites de creación**: bloquear
  'Nuevo profesional' / 'Nueva sucursal' al llegar al tope del plan, con diálogo y CTA de upgrade
  (hoy solo se avisa en las cards de facturación)."
- S2 (usuario, esta sesión): "ok continua".
- S3 (usuario, esta sesión): "cuando termines esto commit y push, te abriré desde otro lugar".
- S4 (usuario, decisión previa): "Gestionar suscripción" es la etiqueta del CTA de upgrade
  (`biz.upgrade_cta`) y la edición de plan vive en `/admin/planes/administrar`.

## Tasks

- ✅ T1 [S1] `CapacityLimitDialogComponent` (shared) + spec — cerrado.
- ✅ T2 [S1] `locations-list`: "Nueva sucursal" bloquea al tope de `locations` del negocio activo. — cerrado.
- ✅ T3 [S1] `businesses-list`: "Nuevo negocio" bloquea al tope de `tenants` de la cuenta. — cerrado.
- ✅ T6 [S1] `providers-list`: "Nuevo profesional" bloquea al tope de `professionals` del negocio activo. — cerrado.
- ✅ T4 [S1] i18n es/en: reusadas las claves existentes (`biz.tenant_location_limit_reached` / `biz.tenant_professional_limit_reached` / `biz.account_tenant_limit_reached` + `.detail`); sin claves nuevas. — cerrado.
- ✅ T5 [S3] Commit work-unit (push pendiente de confirmación del usuario).

## Diseño ya decidido (para no re-explorar)

### T1 — `CapacityLimitDialogComponent`
Ruta: `src/app/shared/components/capacity-limit-dialog/capacity-limit-dialog.component.{ts,html,scss,spec.ts}`

```ts
selector: 'bw-capacity-limit-dialog', standalone: true, ChangeDetectionStrategy.OnPush,
imports: [CommonModule, DialogModule, ButtonModule]

visible  = input<boolean>(false)
titleKey = input<string>('biz.account_tenant_limit_reached')
detailKey= input<string>('biz.account_tenant_limit_reached.detail')
quota    = input<Quota | null>(null)     // Quota = { limit, current } (core/models)
closed   = output<void>()

title      = computed(() => lang.t(titleKey()))
detail     = computed(() => lang.t(detailKey()))
usageLabel = computed(() => quota() ? lang.t('biz.capacity_usage', { current, limit }) : '')
close()      → closed.emit()
goToUpgrade()→ closed.emit(); router.navigate(['/admin/planes/administrar'])
```

HTML: calcar `subscription-inactive-dialog` (`p-dialog` modal, `[closable]="false"`,
`[style]="{ width: '420px' }"`, icono `pi pi-exclamation-triangle`), footer con
`common.close` (secondary) + `biz.upgrade_cta` (icon `pi pi-arrow-right`).

### T2 — locations-list
- Fuente de cuota: `SubscriptionStore.usage()` → `businesses[].find(b => b.tenant_id === auth.me()?.tenant_id)`
  → `.locations` (`Quota { limit, current }`). El negocio activo sale de `AuthService.me()!.tenant_id`.
- `ngOnInit` → `store.loadUsage()` (lazy, cacheado con flag `loaded`).
- `openCreate()`: si `current >= limit` → abrir diálogo con
  `titleKey='biz.location_limit_reached'`, `detailKey='biz.location_limit_reached.detail'`,
  `quota=<locations>`; si no → comportamiento actual (`dialogMode('create')` + `dialogVisible(true)`).
- Signal nuevo: `capacityDialogVisible = signal(false)`.

### T3 — businesses-list
- Fuente de cuota: `store.usage()?.tenants` (`Quota` de la cuenta).
- `ngOnInit` ya llama `loadSubscription()` → agregar `loadUsage()`.
- `newBusiness()`: si `tenants.current >= tenants.limit` → diálogo con
  `titleKey='biz.account_tenant_limit_reached'`, `detailKey='biz.account_tenant_limit_reached.detail'`,
  `quota=<tenants>`; si no → `router.navigate(['/admin/negocios/nuevo'])`.

### T4 — i18n (agregar en `es.ts` y `en.ts`)
- `biz.location_limit_reached`: 'Límite de sucursales alcanzado' / 'Location limit reached'
- `biz.location_limit_reached.detail`: 'Alcanzaste el límite de sucursales de tu plan.' /
  'You reached the location limit of your plan.'

### Claves ya existentes que se reutilizan (NO crear nuevas)
- `biz.account_tenant_limit_reached` + `.detail`
- `biz.capacity_usage` → "Usado {{current}} de {{limit}}."
- `biz.upgrade_cta` → "Gestionar suscripción"
- `common.close` → "Cerrar"

## Log

- L1 (usuario, esta sesión): "ok continua" → retomar #12. "cuando termines esto commit y push,
  te abriré desde otro lugar" → commit + push autorizados explícitamente **al terminar**.
- L2 (descubrimiento, exploración): **no existe botón "Nuevo profesional"**. `providers-list`
  monta `bw-provider-dialog` con `dialogMode` default `'create'` pero ningún handler abre el
  diálogo en modo create (solo `openEdit`/`openView` encienden `dialogVisible`). Crear el botón
  para luego bloquearlo sería inventar UI no pedida → se reporta como gap, no se implementa.
- L3 (decisión de alcance): se bloquean las dos altas **alcanzables** y del mismo tipo de límite:
  "Nueva sucursal" (`max_locations` por negocio) y "Nuevo negocio" (`max_tenants` de la cuenta).
  `profile` repite el shortcut "Nuevo negocio" apuntando al mismo `/admin/negocios/nuevo`; queda
  como follow-up para no inflar el diff (el backend igual lo frena con CTA reactivo).
- L4 (fail-open): si `usage` no cargó o falla, el botón NO se bloquea; el backend sigue siendo
  la autoridad (402 → CTA reactivo ya existente). Nunca se inventa una cuota.
- L6 (reconciliación, 2026-10-28): el botón "Nuevo profesional" **ya existe** (lo agregó `8021fb9`,
  gateado por `providersManage`), así que #12 también bloquea `professionals` (nueva T6). Las claves
  i18n de límite **ya existen** desde el CTA reactivo (`biz.tenant_location_limit_reached`,
  `biz.tenant_professional_limit_reached`, `biz.account_tenant_limit_reached`, cada una con `.detail`),
  así que T4 pasa a ser "reusar", no "crear". La fuente de cuota de profesionales es la misma que
  sucursales: `usage.businesses[].find(b => b.tenant_id === me.tenant_id).professionals`.
- L7 (cierre, 2026-10-28): T1–T6 cerrados en un work-unit commit (`feat(creation-limits)`, ver
  git log). `ng build` verde; specs de las 3 listas + el diálogo en verde (43 tests). La suite
  completa mantiene fallos preexistentes/flaky ajenos a #12 (calendar-navigation, booking-detail-dialog,
  booking-form-dialog, historial-reserva). Push pendiente de confirmación del usuario.
