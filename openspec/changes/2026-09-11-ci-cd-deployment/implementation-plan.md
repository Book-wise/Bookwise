# Plan implementable — CI/CD del frontend Bookwise

> Diseño para ejecución posterior por Sebacirk y administración de infraestructura.
> No representa infraestructura aplicada ni workflows existentes.

## 1. Resultado buscado

Publicar el frontend Angular en QA como un artefacto inmutable, construido una sola vez fuera del servidor,
activado mediante un symlink atómico y reversible sin modificar ni volver a desplegar el backend Laravel.

## 2. Estado de partida verificado

### Repositorio local

- Rama frontend: `feature/ci-cd-deployment`, con upstream del mismo nombre.
- Base observada: `d5bf72a`.
- No existen workflows en `.github/workflows/`.
- Producción debe usar `src/environments/environment.prod.ts`, cuyo `apiUrl` es `/api/v1`.
- La suite observada tiene 38 fallos agrupados en cuatro causas; ver `tests-handoff.md`.

### QA, inspección de solo lectura del 2026-09-11

- Host: `bookwise-angular-laravel-mysql-ubuntu-1vcpu-1gb-25gb-nyc1`.
- Recursos: 961 MiB RAM, 1 GiB swap y aproximadamente 18 GiB libres.
- Servicios activos: Nginx, MySQL y PHP 8.3-FPM.
- Release activa: `/srv/bookwise/releases/20260820T204436Z`.
- Symlink conjunto: `/srv/bookwise/current -> releases/20260820T204436Z`.
- Nginx sirve el frontend desde `/srv/bookwise/current/frontend/browser`.
- PHP-FPM ejecuta `/srv/bookwise/current/backend/public/index.php`.
- No existen `/srv/bookwise/shared` ni `/srv/bookwise/backups`.
- Todo el layout observado pertenece a `root`; no existe un usuario de deploy confirmado.
- Smoke local: `/` = 200, `/up` = 200, `/api/v1` = 404.

## 3. Decisión arquitectónica

Aplicar el patrón de Capistrano sin incorporar Ruby ni la gema Capistrano:

- releases inmutables;
- artefactos identificados por timestamp UTC y SHA;
- symlink `current` por unidad desplegable;
- activación atómica;
- rollback por cambio de symlink;
- retención acotada;
- construcción en GitHub Actions, nunca en QA.

La unidad desplegable inmediata es solo el frontend. El backend conserva inicialmente su ruta actual.

## 4. Layout objetivo de transición

```text
/srv/bookwise/
├── frontend/
│   ├── releases/
│   │   ├── 20260911T170000Z-a1b2c3d/
│   │   │   └── browser/
│   │   └── 20260912T120000Z-b2c3d4e/
│   │       └── browser/
│   └── current -> releases/20260912T120000Z-b2c3d4e
├── releases/
│   └── 20260820T204436Z/
│       └── backend/
└── current -> releases/20260820T204436Z
```

Durante esta fase, Nginx debe usar:

```text
root /srv/bookwise/frontend/current/browser;
SCRIPT_FILENAME /srv/bookwise/current/backend/public/index.php;
```

Esto separa los ciclos de release sin migrar el backend en el mismo cambio.

## 5. Contrato del artefacto

- Fuente: checkout exacto del SHA que disparó el workflow.
- Node: versión LTS fijada explícitamente y compatible con el lockfile; propuesta inicial Node 22.
- Instalación: `npm ci`.
- Construcción: `npm run build -- --configuration production`.
- Raíz publicable: `dist/bookwise/browser/`.
- Nombre lógico: `bookwise-frontend-<timestamp-UTC>-<sha-corto>`.
- Contenido obligatorio: `index.html` y al menos un bundle JS principal.
- Contenido prohibido: `.env`, fuentes TypeScript, `node_modules`, secretos o la URL
  `127.0.0.1:9999`.
- Integridad: manifiesto con SHA-256 de los archivos o checksum del archivo empaquetado.
- El mismo artefacto validado debe ser el desplegado; QA no recompila.

## 6. Diseño de workflows

### `ci.yml`

Disparadores propuestos:

- `pull_request` hacia la rama de integración acordada.
- `push` a esa rama.
- `workflow_dispatch` para diagnóstico controlado.

Pasos:

1. Checkout por SHA.
2. Configurar Node 22 y caché de npm basada en `package-lock.json`.
3. `npm ci`.
4. `npm test -- --no-watch`.
5. `npm run build -- --configuration production`.
6. Rechazar el build si contiene `127.0.0.1:9999`.
7. Validar `dist/bookwise/browser/index.html`.
8. Empaquetar y publicar artefacto con retención corta.

Permisos del token: `contents: read`.

### `deploy-qa.yml`

Fase inicial:

- Solo `workflow_dispatch`.
- Recibe el SHA o usa el SHA seleccionado explícitamente.
- Usa el environment GitHub `qa`.
- Descarga o reconstruye únicamente si puede demostrar que corresponde al SHA seleccionado. La opción
  preferida es promover el artefacto producido por CI.
- Un concurrency group `deploy-qa` impide dos activaciones simultáneas.
- Timeout explícito y comandos SSH no interactivos.

Pasos remotos conceptuales:

1. Crear el directorio de una release nueva.
2. Transferir el artefacto completo a esa release.
3. Validar existencia, tamaño y checksum.
4. Capturar el destino anterior de `frontend/current`.
5. Crear un symlink temporal hacia la nueva release.
6. Renombrar el symlink temporal sobre `current` de forma atómica.
7. Ejecutar smoke tests externos.
8. Si falla: restaurar el destino anterior, repetir smoke y terminar el job en rojo.
9. Si pasa: registrar SHA/release y podar releases antiguas, conservando cinco.

No debe ejecutar `npm`, Composer, Artisan, migraciones, MySQL ni reinicios de PHP-FPM.
Nginx no necesita recargarse cuando solo cambia el contenido del symlink.

### `rollback-qa.yml`

- Solo `workflow_dispatch`.
- Parámetro obligatorio: `previous` o identificador exacto de release.
- Validar que el destino exista bajo `/srv/bookwise/frontend/releases/` y contenga `browser/index.html`.
- Reapuntar atómicamente `current`.
- Ejecutar los mismos smoke tests.
- No descargar, compilar ni tocar la base de datos.

## 7. Smoke tests

Mínimo obligatorio:

1. `GET /` devuelve 200.
2. El HTML contiene el selector raíz Angular esperado.
3. El HTML servido referencia un bundle que existe y responde 200.
4. El hash o nombre del bundle servido coincide con el artefacto activado.
5. `GET /up` devuelve 200 para comprobar que el proxy/backend sigue operativo.

No usar `GET /api/v1` como gate mientras esa ruta raíz responda 404 por diseño. Sebacirk debe identificar un
endpoint GET seguro, sin autenticación y estable si se necesita una comprobación API adicional.

## 8. Caché y rollback

- `index.html`: `Cache-Control: no-cache` o equivalente que fuerce revalidación.
- Assets con hash: `Cache-Control: public, max-age=604800, immutable`.
- Una release anterior debe conservar todos sus assets; no compartir directorios de bundles entre releases.
- Rollback de frontend nunca restaura base de datos.
- El workflow debe quedar rojo aunque el rollback automático haya recuperado el servicio.

## 9. Seguridad operacional

- Crear una cuenta `deploy` dedicada, sin `sudo` general.
- Propiedad propuesta: `deploy:www-data` para `/srv/bookwise/frontend`.
- Permisos propuestos: directorios 755 y archivos 644, ajustados si la política del host exige otra cosa.
- La clave privada vive solo en GitHub Actions; nunca en el repositorio ni logs.
- Fijar `known_hosts`; no usar `StrictHostKeyChecking=no`.
- Permitir escritura únicamente en `/srv/bookwise/frontend/releases` y en el symlink
  `/srv/bookwise/frontend/current`.
- No reutilizar permanentemente la cuenta `root` ni una clave administrativa personal para CI.
- Los comandos remotos deben rechazar identificadores con `/`, `..`, espacios o caracteres fuera de
  `[A-Za-z0-9._-]`.

## 10. Transición inicial sin corte

Responsable: administrador del servidor, coordinado con Sebacirk.

1. Capturar la configuración Nginx vigente y validar `nginx -t`.
2. Crear el layout independiente y copiar como primera release el frontend actualmente servido.
3. Crear `frontend/current` hacia esa copia.
4. Verificar localmente que `frontend/current/browser/index.html` existe.
5. Cambiar únicamente el `root` de Nginx al nuevo symlink; mantener la ruta PHP actual.
6. Ejecutar `nginx -t` y recargar Nginx.
7. Ejecutar smoke tests.
8. Ante fallo, restaurar el `root` anterior y recargar.

Este bootstrap es el único paso que necesita modificación de Nginx. Los releases siguientes no deben
recargarlo.

## 11. Secuencia de adopción

### Gate A — código preparado por Sebacirk

- Suite completa verde.
- Build productivo correcto.
- Sustitución de environment confirmada.
- Workflows revisados mediante PR.

### Gate B — GitHub preparado por administrador

- Environment `qa` creado.
- Variables y secretos configurados.
- Aprobadores y protección definidos según capacidades del plan de GitHub.
- Branch protection y checks obligatorios configurados después de que CI sea estable.

### Gate C — servidor preparado por administrador

- Usuario `deploy` y clave dedicados.
- Layout independiente creado.
- Nginx migrado con rollback comprobado.
- Permisos mínimos probados.

### Gate D — primer release

- Despliegue manual de un SHA conocido.
- Evidencia de release activa.
- Smoke correcto.
- Rollback manual ensayado y reactivación posterior comprobada.

### Gate E — automatización posterior

Solo después de varios releases manuales correctos se evalúa desplegar automáticamente por push. No es un
requisito de la primera versión.

## 12. Definition of Done de la estrategia

- Sebacirk puede implementar workflows sin inventar rutas, gates o comportamiento de rollback.
- El administrador conoce exactamente qué debe cambiar en GitHub y QA.
- Frontend y backend tienen ciclos de release independientes.
- Ningún build ocurre en QA.
- Todo release es trazable a un SHA.
- Activación y rollback están probados, no solo documentados.
- No existen secretos en repositorio o logs.
