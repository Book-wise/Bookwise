# Servicios Externos

## API Laravel

El README existente menciona API Laravel. El codigo confirma consumo HTTP hacia:

- Desarrollo: `http://127.0.0.1:9999/api/v1`.
- Produccion: `/api/v1`.

Fuentes: `README.md`, `src/environments/environment.ts`, `src/environments/environment.prod.ts`.

## WhatsApp

La UI genera links `https://wa.me/...` para contacto de pacientes. No hay SDK ni API server-side de WhatsApp en este frontend.

## WooCommerce

Hay campos `wc_customer_id` y `wc_order_id` en modelos, pero no hay cliente HTTP hacia WooCommerce. El README dice que el frontend consume la API Laravel directamente y no pasa por WooCommerce.

## Google Fonts o fuentes locales

El repositorio incluye fuentes Roboto y Fira Code bajo `src/assets/fonts`. No se verifico carga remota de fuentes; los archivos estan presentes localmente.

## Desconocido o no verificable

No hay credenciales, llaves de API ni configuracion de proveedores externos en el repositorio revisado.

