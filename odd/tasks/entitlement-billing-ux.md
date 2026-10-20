# Entitlement & Billing UX (Fase A)

Pulir la experiencia de entitlement/facturación sobre la base del catch-up de
contratos (`feat/contract-catchup`): copy neutro, CTA de upgrade, diálogo de
suscripción inactiva, y add-ons en "Detalles del plan".

## Specs

- **S1** — "los mensajes siempre en español neutro y sin voseos, mas las traducciones
  correspondientes". (El voseo queda solo en la charla con el agente, nunca en el producto.)
- **S2** — `permission_required`: "vale la pena mencionar que solicite los permisos a su
  administrador" → detalle tipo "No tienes permiso para esta acción. Solicita acceso a tu
  administrador."
- **S3** — 402 `subscription_inactive`: "un CTA en dialogo con un boton que le diga tu cuenta
  esta inactiva, si es el usuario dueño de la cuenta, que lo mande a reactivar a la pagina de
  facturacion." Dueño → botón "Reactivar suscripción" → `/admin/facturacion`; no-dueño → sin
  botón, "Solicita al administrador de la cuenta que la reactive."
- **S4** — "el boton de ver los planes puede enviar a una pagina donde se destacan todos los
  planes disponible y sus beneficios, y en vez decir todos los planes, ponle mejora tu plan,
  siendo este un boton mas de CTA." → renombrar `billing.see_all_plans` a "Mejora tu plan" y
  navegar a una página nueva `/admin/planes` (planes + beneficios; mock hasta `GET /v1/plans`).
- **S5** — Add-ons: "deberiamos presentar la posibilidad de adicionarlos y en caso que ya
  estuvieran añadidos, presentarlos en el resumen de lo incluido en la cuenta." + "ya tenemos
  una seccion de detalles del plan... donde podemos indicar lo que se tiene y cual es el costo
  actual." → en "Detalles del plan" mostrar `pack_credit` (incluido) + costo (mock hasta que
  exista endpoint de precios).
- **S6** — Perfil: "podemos hacerle saber si es general del negocio especifico o de la location?
  en un formato entendible, no necesitamos decirle con los mismos terminos que el backend."
  → rol de negocio en lenguaje humano: `admin_general` → "Administrador general",
  `admin_local` → "Administrador de sucursal".
- **S7** — Negocios: "en la pantalla de negocios, no hace falta que le pongas un plan o titulo
  mockup de plan para cada negocio, eso ya quedara esclarecido em facturacion" → quitar el
  chip de `biz.plan` de cada fila.

## Tasks

- **T1** (S1, S2) — Copy neutro + `permission_required` con "solicita acceso a tu administrador".
- **T2** (S4) — Renombrar botón a "Mejora tu plan" + página `/admin/planes` (planes + beneficios, mock).
- **T3** (S3) — Diálogo bloqueante para 402 `subscription_inactive` (dueño vs no-dueño).
- **T4** (S5) — Add-ons en "Detalles del plan" (`pack_credit` + costo, mock).
- **T5** (S6) — Rol de negocio en lenguaje humano en el perfil.
- **T6** (S7) — Quitar chip de plan mock en la pantalla de negocios.

## Log

- **L1** — Dirección de Fase A (verbatim): "los mensajes siempre en español neutro y sin voseos",
  "que solicite los permisos a su administrador", "un CTA en dialogo... que lo mande a reactivar a
  la pagina de facturacion", "ponle mejora tu plan", "presentar la posibilidad de adicionarlos y
  en caso que ya estuvieran añadidos, presentarlos en el resumen de lo incluido en la cuenta".
- **L2** — Hallazgos de análisis:
  - **S6 (rol en perfil):** `/auth/me` (UserResource) expone `role` (técnico) + `is_admin_general` +
    `is_admin_local`; **no** expone el slug completo del rol de negocio. Solución inmediata: mapear
    los dos flags admin a "Administrador general" / "Administrador de sucursal". Fidelidad total de
    rol (recepcionista/staff/etc.) requiere campo aditivo backend → pendiente en Fase B (rbac-frontend).
  - **S7 (negocios):** el chip `biz.plan` de cada fila es mock → se quita; el plan se ve en Facturación.
  - **S4/S5 (planes + add-ons):** `GET /v1/plans` y el endpoint de precios/cobro están parked en
    backend → la página de planes y el costo de add-ons arrancan mock, estructurados para enchufar API.
