# Inventario De Endpoints Consumidos

Fuente principal: `src/app/core/services/api.service.ts`. Base URL segun entorno: `environment.apiUrl`.

## Publicos o marcados como publicos en comentarios

| Metodo | Path | Uso frontend |
| --- | --- | --- |
| GET | `/locations` | Listar sedes |
| GET | `/locations/:id` | Obtener sede |
| GET | `/services` | Listar servicios |
| GET | `/services/:id` | Obtener servicio |
| POST | `/services` | Crear servicio |
| GET | `/packs` | Listar packs paginados |
| GET | `/packs/:id` | Obtener pack |
| GET | `/available_slots` | Obtener slots disponibles |
| GET | `/blocked-slots` | Listar bloqueos |
| POST | `/blocked-slots` | Crear bloqueo |
| PATCH | `/blocked-slots/:id` | Actualizar bloqueo |
| DELETE | `/blocked-slots/:id` | Eliminar bloqueo |
| DELETE | `/blocked-slots/group/:groupId` | Eliminar grupo de bloqueos |
| POST | `/auth/login` | Login |
| POST | `/register` | Registro |

## Autenticados segun comentarios de `ApiService`

| Metodo | Path | Uso frontend |
| --- | --- | --- |
| GET | `/providers` | Listar providers, opcional `location_id` |
| GET | `/providers/:id` | Obtener provider |
| GET | `/bookings` | Listar reservas con filtros |
| GET | `/bookings/:id` | Obtener reserva |
| POST | `/bookings` | Crear reserva |
| PATCH | `/bookings/:id` | Actualizar reserva |
| PATCH | `/bookings/:id/cancel` | Cancelar reserva |
| GET | `/clients` | Listar/buscar clientes |
| GET | `/clients/:id` | Obtener cliente |
| POST | `/clients` | Crear cliente |
| PATCH | `/clients/:id` | Actualizar cliente |
| GET | `/clients/:clientId/packs` | Packs de cliente |
| GET | `/sales` | Listar ventas |
| GET | `/sales/:id` | Obtener venta |
| POST | `/sales` | Crear venta |
| PATCH | `/sales/:id` | Actualizar venta |
| GET | `/sales/:saleId/transactions` | Listar transacciones |
| POST | `/sales/:saleId/transactions` | Crear transaccion |
| DELETE | `/sales/:saleId/transactions/:transactionId` | Eliminar transaccion |
| GET | `/client-packs` | Listar client packs |
| PATCH | `/client-packs/:clientPackId/use` | Usar sesion de pack |

## Fuera de `ApiService`

`AvailabilityService.getLocationAvailability()` consume `GET /available_slots` directamente. Los endpoints para disponibilidad de provider estan comentados como TODO y no se ejecutan.

## Desconocido o no verificable

No se verifico si estos endpoints existen realmente, si requieren auth en backend o si sus respuestas coinciden con los tipos.

