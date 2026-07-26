# Carlitox — Agente Conversacional

> Documentación de endpoints disponibles para el agente conversacional de Kinesilk.
> Reunión: 03/06/2026 · Responsable: Carlos · Repo: [Bookwise-API](http://github.com/sebaquevedo/Bookwise-API)

---

## Autenticación

Carlitox usa un **Sanctum token dedicado** con rol `agent`. Se obtiene via `POST /v1/auth/login` igual que cualquier otro rol:

```json
{
  "email": "agent@kinesilk.cl",
  "password": "..."
}
```

### Scopes del token `agent`

| Scope | Propósito |
|---|---|
| `bookings:read` | Consultar reservas |
| `clients:read` | Buscar y ver clientes |
| `clients:write` | Registrar RUT / teléfono del cliente |
| `providers:read` | Consultar profesionales |

> **⚠️ Carlitox NO tiene `bookings:write`.** Las reservas que proponga requieren confirmación explícita del cliente.

---

## Endpoints públicos (sin auth)

| Propósito | Endpoint | Descripción |
|---|---|---|
| Listar centros | `GET /v1/locations` | Centros activos con dirección y horario |
| Listar servicios | `GET /v1/services` | Servicios con precio, duración e intervalo |
| Listar packs | `GET /v1/packs` | Packs de servicio con sesiones y precio |
| Ver servicio | `GET /v1/services/{id}` | Servicio individual con `providers` embebidos |
| Ver centro | `GET /v1/locations/{id}` | Centro individual con `providers` embebidos |
| Ver pack | `GET /v1/packs/{id}` | Pack individual con `service` embebido |

### Sobre los packs

Un `ServicePack` está vinculado a **un solo servicio**. No existen packs con servicios mixtos. Es descuento por volumen del mismo servicio.

```
Pack Kinesiología x8:
  total_sessions: 8
  price:          $288.000  (total con descuento)
  service:        Kinesiología - $40.000/sesión individual
```

Cuando un cliente pregunte por un servicio, Carlitox debe presentar **dos opciones**:
1. Sesión individual al precio del servicio
2. Pack disponible (si existe) con su ahorro respecto a pago por sesión

Para obtener ambas: `GET /v1/services` + `GET /v1/packs`, Carlitox une la información.

---

## Endpoints autenticados (Bearer token — rol `agent`)

### Buscar cliente por teléfono

```
GET /v1/clients?search=+56912345678
```

Busca por coincidencia parcial en nombre, apellido, email y teléfono.

**Respuesta:**
```json
{
  "data": [
    {
      "id": 12,
      "first_name": "María",
      "last_name": "González",
      "phone": "+56912345678",
      "rut": null,
      "rut_missing": true,
      "email": "maria@example.com",
      "active": true
    }
  ]
}
```

### Buscar cliente por RUT

```
GET /v1/clients?rut=12345678-5
```

Filtro exacto agregado en PR #9. Match directo sobre `clients.rut`.

### Ver datos de una reserva

```
GET /v1/bookings/{id}
```

Requiere scope `bookings:read`. Devuelve detalle completo con cliente, servicio, profesional, centro, estado, payment_status y datos del pack si aplica.

### Consultar disponibilidad para hora puntual

```
GET /v1/agent/check-availability?service_id=3&date=2026-06-10&time=15:00
```

Endpoint diseñado específicamente para Carlitox (PR #12). A diferencia de `GET /v1/available_slots` (que requiere `location_id` y devuelve todo el día), este endpoint:

- No necesita `location_id` — busca en **todas las sedes**
- Filtra por **hora puntual**, no todo el día
- Devuelve **quién** está disponible, no solo slots genéricos

**Respuesta:**
```json
{
  "available": true,
  "slots": [
    {
      "provider": { "id": 7, "first_name": "Ana", "last_name": "Fernández" },
      "location": { "id": 3, "name": "Kinesilk Providencia" },
      "start_time": "2026-06-10T15:00:00",
      "end_time": "2026-06-10T16:00:00"
    }
  ]
}
```

### Guardar RUT del cliente

```
PATCH /v1/clients/{id}
Authorization: Bearer <token agent>
Content-Type: application/json

{ "rut": "12.345.678-5" }
```

Requiere scope `clients:write`. Valida con **Módulo 11 chileno** (`ChileanRutRule`). El mismo endpoint permite actualizar `phone` si hace falta.

---

## Flujo de registro de RUT

Cuando Carlitox ubica a un cliente y este no tiene RUT registrado:

```
1. GET /v1/clients?search=+56912345678
   → respuesta incluye "rut_missing": true

2. Carlitox le pide el RUT al cliente

3. PATCH /v1/clients/{id}  con { "rut": "12.345.678-5" }

4. Confirmar al cliente que el RUT quedó registrado
   → respuesta con "rut_missing": false
```

### Respuestas de error que Carlitox debe interpretar

| Status | Body | Significado | Acción de Carlitox |
|---|---|---|---|
| `422` | `{ "rut": ["El RUT debe tener formato válido (ej: 12345678-9)."] }` | Formato inválido | Pedir al cliente que repita el RUT indicando el formato esperado |
| `422` | `{ "rut": ["El RUT no es válido."] }` | Dígito verificador incorrecto (Módulo 11) | Avisar al cliente que el RUT parece incorrecto y pedirle que lo confirme |
| `422` | `{ "rut": ["The rut has already been taken."] }` | Ya existe otro cliente con ese RUT | Escalar a un humano — posible cliente duplicado |

---

## Historial de cambios

| Fecha | Cambio | PR |
|---|---|---|
| 03/06/2026 | Documentación inicial del agente conversacional | — |
| Semana 1 Jun 2026 | Filtro `?rut=` en `GET /v1/clients` | PR #9 |
| Semana 1 Jun 2026 | Endpoint `GET /v1/agent/check-availability` | PR #12 |
| Semana 1 Jun 2026 | Rol `agent` + token dedicado con scopes | PR #11 |
| Semana 1 Jun 2026 | Fix: DV `K` en validación RUT (Módulo 11) | PR #10 |
