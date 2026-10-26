# Pedido FE → BE — Serie histórica de consumo de confirmaciones (2026-10-21)

Pantalla: `/admin/facturacion` → sección **"Consumo mensual"** (gráfico de líneas).

**Estado actual:** el gráfico usa datos **MOCK**. `GET /v1/subscription/usage` solo devuelve
el **período actual** (`confirmations.email/whatsapp` con `period_start/period_end`,
`consumed`, `limit`, `remaining`, `pack_credit`, `by_tenant`). No existe serie histórica, así
que el frontend no puede graficar una tendencia real.

Backend de referencia: Bookwise-API (`develop`).

---

## 1. Qué necesitamos (frontend)

Un gráfico de consumo mensual con los últimos **N meses** (default 6, hasta 12), con el
consumo **REAL** de confirmaciones **por canal** (`email`, `whatsapp`).

- Eje X: meses (etiqueta corta; el FE formatea según idioma a partir de `YYYY-MM`).
- Eje Y: confirmaciones consumidas en el mes.
- Series: `email` y `whatsapp` (una línea por canal).

Alternativa aceptable: una sola serie "total confirmaciones" si al BE le simplifica, pero
preferimos por canal porque la UI ya separa ambos en las cards de "Uso del plan".

---

## 2. Contrato propuesto

### Opción A (recomendada): endpoint dedicado

`GET /v1/subscription/usage/history?months=6`

- **Auth:** Bearer, mismo gate que `GET /v1/subscription/usage`
  (`402 subscription_inactive` si la suscripción está inactiva; `403` si no hay membership activa).
- **`months`:** entero `1..12`, default `6`. Incluye meses calendario cerrados + el mes en curso.
- **Scope:** cuenta activa (bucket compartido), **NO** por tenant.

```json
{
  "data": {
    "months": [
      {
        "month": "2026-05",
        "email":    { "consumed": 1180, "limit": 2500 },
        "whatsapp": { "consumed": 540,  "limit": 800 }
      },
      {
        "month": "2026-06",
        "email":    { "consumed": 1420, "limit": 2500 },
        "whatsapp": { "consumed": 610,  "limit": 800 }
      }
    ]
  }
}
```

Reglas:

- Devolver **siempre** `months` buckets, **rellenando con `consumed: 0`** los meses sin datos.
- `month` en formato `YYYY-MM` (o `YYYY-MM-01`); orden **ascendente**.
- `limit` **opcional** (si el plan cambió en el período, usar el límite vigente de ese mes).
- `consumed` = suma de confirmaciones del canal dentro del mes, con **el mismo criterio** que
  `confirmations.*.consumed` del endpoint actual.
- Definir y documentar la **zona horaria** de corte del mes (UTC o la de la cuenta). Hoy
  `period_start/period_end` llegan con `+00:00`.

### Opción B (si no quieren endpoint nuevo)

Extender `GET /v1/subscription/usage` con un campo **aditivo**:

```json
"history": {
  "months": [ /* misma forma que arriba */ ]
}
```

Cualquiera sirve; la A es más limpia porque el payload actual ya es grande.

---

## 3. Seed solicitado (dev/demo)

Para ver el gráfico con datos **reales** antes de producción:

- Sembrar `confirmation_usage` (o la tabla que respalde el consumo de confirmaciones) con
  **6 meses** de datos para la cuenta demo, con **variación realista** mes a mes (no planos)
  y respetando el límite del plan de cada mes.
- Incluir ambos canales (`email`, `whatsapp`; `email` bastante mayor que `whatsapp`).
- Mantener el desglose por tenant (`by_tenant`) coherente con las cards de "Uso del plan".
- Incluir **al menos un mes cerca del límite (>90%)** para ver el estado "warning/danger".

Valores sugeridos (plan Premium: email 2500/mes, WhatsApp 800/mes):

| Mes | email | whatsapp |
|-----|-------|----------|
| -5  | 1180  | 540      |
| -4  | 1420  | 610      |
| -3  | 980   | 430      |
| -2  | 2100  | 720      |
| -1  | 2340  | 780      |
| 0   | 1200  | 640      |

> El mes 0 debe reflejar el consumo **real** acumulado a la fecha (no forzar el seed si ya hay
> datos reales en el período en curso).

---

## 4. Criterios de aceptación

- [ ] `GET /v1/subscription/usage/history?months=6` devuelve **6 buckets ascendentes** con
      `email`/`whatsapp` por mes, rellenando meses vacíos con `consumed: 0`.
- [ ] Con el seed, el gráfico de `/admin/facturacion` muestra **dos líneas con datos reales**
      y la forma esperada (sin picos planos artificiales).
- [ ] El **mes en curso** incluye el consumo real acumulado a la fecha.
- [ ] Auth/gating igual al endpoint de usage actual (`402`/`403` consistentes).
- [ ] Parámetro inválido (`months` fuera de 1..12) → `422` con el envelope estándar.

---

## 5. Qué hace el FE cuando esté listo

- Reemplazar el `consumptionData` mock por la llamada nueva, cacheada en `SubscriptionStore`
  (con `invalidate*`, igual que `usage`).
- Derivar `consumptionLabels` del `month` del backend (formateo por idioma).
- Eliminar los datos mock actuales (`[2,2,3,3,3,3]`, `[12500,...]`).

---

## 6. Referencias FE

- `src/app/features/admin/billing/billing.component.ts` → `consumptionData`, `consumptionLabels`.
- `src/app/core/models/index.ts` → `UsageData`, `ConfirmationUsage`.
- `src/app/core/services/api/subscription-api.service.ts`.
- Doc de continuidad: `odd/tasks/billing-plans-addons.md` (#23), `odd/tasks/pago-plan-split.md`.
