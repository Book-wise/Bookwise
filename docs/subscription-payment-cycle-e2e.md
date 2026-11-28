# Ciclo completo de activación de suscripción — consolidación FE/BE/Transbank (2026-11-22)

Fuentes: docs oficiales Transbank Oneclick (referencia + producto), backend verificado
(develop @ e86ab18 + feat/transbank-p1 @ 5cc4c43, por orquestador), FE P1 mergeado (PR #63),
 memoria de proyecto (`transbank-oneclick-integration`), T&C Transbankdevelopers (docs/).

---

## 1. Estado de los actores (quién tiene qué)

### HECHO

**Backend (Bookwise-API):**
- Modelo subscription completo: `Subscription.status` ∈ pending|active|past_due|paused|cancelled|expired,
  `isLive()` = active|past_due; nace **pending**; grace past_due con reintentos días 1/3/7
  (`billing:retry-past-due`), pausa a los 8 días (`billing:expire-subscriptions`).
- `PaymentStatus` ∈ pending|succeeded|failed|refunded|requires_action (pending y requires_action
  reservados para Transbank real — hoy ningún flujo los produce).
- `PaymentInscription` (P1): started → confirming → confirmed (happy path enrolamiento) | failed | expired | cancelled.
- Renovador (`billing:process-renewals` → `attemptRecurringCharge`):
  - Gateway OFF → renueva **sin cobrar** (extiende período).
  - Gateway ON + método default **manual** → renueva sin cobrar (facturación a mano).
  - Gateway ON + default **chargeable** → `charge()` del gateway; exitoso → renovado; fallido → past_due.
  - Gateway ON + **sin** método default → pago failed `no_default_payment_method` → past_due.
- `POST /v1/subscription/plan` (changePlan, 402 sin vigente / 409 en past_due/pending).
- `PUT /v1/subscription/addons` (add-ons a la boleta del período siguiente).
- `GET /v1/payments`: {id, kind(recurring|manual|refund|adjustment), provider, provider_transaction_id,
  amount_clp, currency, status, failure_code, paid_at, created_at} — paginado 25, filtros status/from/to.
- Inscripción Oneclick Mall P1: enroll → redirect_url Webpay → return público (hash del token,
  idempotente) → confirmación 60s → PaymentMethod active (contrato pinnado en S4–S9; FE #63 ya lo consume).
- ENV e2e exacta: FRONTEND_URL, TRANSBANK_PROVIDER_KEY, TRANSBANK_ENABLED,
  TRANSBANK_CONTRACT_CONFIRMED, TRANSBANK_COMMERCE_CODE (Mall), TRANSBANK_CHILD_COMMERCE_CODE,
  TRANSBARK_API_KEY_SECRET, TRANSBANK_ENVIRONMENT=integration, TRANSBANK_WEBHOOK_SECRET,
  TRANSBANK_RETURN_URL, TRANSBANK_FRONTEND_RESULT_URL.
- Comandos manuales del ciclo: `billing:process-renewals`, `billing:retry-past-due`,
  `billing:expire-subscriptions` (scheduler MASTER).

**Frontend (PR #63 mergeada):**
- Card "Medio de pago": enroll (redirect a Webpay), estado, baja con confirmación, conflictos 409/502/503.
- Página `/payment/enrollment` pública: no confía en la query (ok solo con tarjeta activa verificada),
  unconfirmed/neutral, noindex, i18n es/en, split 04/franja 05.
-facturación hub + Mi plan + historial (services mock) + datos fiscales.

**Transbank (ambiente integración, público — sin barrera contractual):**
- Códigos: Mall 597055555541, Tienda1 597055555542, Tienda2 597055555543; secret pública de integración.
- Tarjetas: VISA 4051 8856 0044 6623 / CVV 123 (aprueba); MASTER 5186 0595 5959 0568 (rechaza);
  auth bancaria RUT 11.111.111-1 clave 123;flujo timeout 10 min en integración.
- Ciclos de inscripción: normal/timeout (solo TBK_TOKEN), abortado (+TBK_ORDEN_COMPRA+TBK_ID_SESION).

### FALTA (gaps ordenados por bloqueo)

1. **[BLOQUEA ciclo completo] pending → active por primer cobro**: no existe endpoint de
   checkout/primera mensualidad. `changePlan` no cobra. El BE lo ofrece como spec del flujo
   pending→active con checkout de primera mensualidad (entraría en P2 junto con el charge).
2. **[BLOQUEA cobro automático] Charge OneClick Mall** = P2: el provider P1 solo inscribe;
   `charge/getPaymentStatus/refundOrReverse` fallan cerrado. Hasta entonces el e2e realista usa
   gateway OFF o default manual.
3. **[P2 FE] T5 nonce/adaptación**: `GET /v1/payment-methods/enrollment-result?n=` (Sanctum)
   + nonce one-use 300s, 410 Gone — contrato confirmado (S14), implementación del BE esperando
   que el mantenedor desbloquee `feat/transbank-p1`.
4. **Boleta de suscripción**: sale-receipt existe solo para ventas de tenant; el ciclo de
   facturación no emite comprobante hoy.
5. **Seeders e2e**: no hay seeder de payment_inscriptions ni usuario billing de prueba —
   crear en la suite e2e del FE/BE conjunto.
6. **`/admin/facturacion/historial`** sigue con servicios mock; estaba cablear a `GET /v1/payments`
   (la API existe, el FE no la consume todavía).

---

## 2. Matriz e2e del ciclo (propuesta BE + completa)

| Caso | Setup | Acción | Resultado esperado |
|---|---|---|---|
| A | Gateway OFF | renewals corren | período extendido, sin pago, sub sigue active |
| B | Gateway ON + default manual | renewals | renueva sin cobrar (factura a mano) |
| C | Gateway ON + sin método | renewals | payment failed `no_default_payment_method` → past_due |
| D | Inscripción Happy path | enroll → Webpay (VISA pruebas) → return | PaymentMethod active; pantalla FE éxito; card en Facturación |
| E | Inscripción rechazo | enroll → MASTER rechazada | reason rejected → página error + causas; método NO active |
| F | Inscripción timeout/abort | 10 min o anular | elapsed/cancelled → mensaje correspondiente |
| G | Change card | tarjeta activa + enroll nuevo → esperado 409 | delete-then-enroll es único camino (S9) |
| H | Baja + History | eliminar tarjeta → retry-past-due/Card | baja del proveedor + método disabled + estado FE vacío |

**Caso completo pendiente P2**: seleccionar plan → pagar primera mensualidad (Webpay) → sub pending→active
→ renovaciones automáticas con charge → fallos → gracia/past_due/paused.

---

## 3. Plan inmediato cuando el BE libere P2

1. BE: charge OneClick + checkout de primera mensualidad (su spec pendiente de OK del mantenedor).
2. FE (T5): consumir `enrollment-result` como verdad única; polling corto processing; 410 → neutral.
3. FE: cablear History a `GET /v1/payments` (sin mock).
4. e2e conjunto: seeder usuario billing + tarjeta de pruebas, correr casos D–H + ciclo completo.
5. Validación portal: formulario transbankdevelopers solo al paso a producción (comercio real).
