# CI/CD de desarrollo — Bookwise frontend

**Alcance:** frontend Angular en `dev.bookwise.cl`. Este repo publica sólo los
archivos estáticos del frontend; el API tiene su propio workflow y release.
**Estado al 2026-11-18:** workflow y script están en `feature/ci-cd-deployment`;
no se verificó que estén integrados en GitHub `develop`, ni se consultaron runs,
Environments, secretos o branch rules. No es documentación de producción.

## Archivos y flujo

- Workflow: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml).
- Script remoto: [`scripts/deploy-dev.sh`](../../scripts/deploy-dev.sh).
- Entrada breve: [README.md](../../README.md#despliegue-de-desarrollo).

El workflow escucha `push` y `pull_request` hacia `develop`. Un push normal y
cualquier PR ejecutan CI; ninguno despliega por sí mismo. Para desplegar, el
mensaje del **commit final en la punta de `develop`** debe contener esta línea
exacta, en su propia línea:

```text
Deploy-Dev: true
```

El job de deploy exige `push`, señal exacta, tests y build verdes, y comprueba
que el SHA todavía sea la punta actual de `develop`. Si hay un push más nuevo,
rechaza el SHA atrasado. Los PR desde feature sólo validan; el deploy ocurre
después de integrar a `develop` y preservar la señal en el commit resultante.

| Job | Función |
|---|---|
| `deploy-signal` | Lee el mensaje del commit checkout y expone si hay señal exacta. |
| `tests` | Node 22, `npm ci`, `npm test -- --no-watch`. |
| `package-release` | Build Angular de producción; verifica que exista `index.html` y que el bundle no tenga la URL local `127.0.0.1:9999`; genera tar y SHA-256. El artefacto se conserva 14 días. |
| `deploy-development` | Revalida SHA, descarga el artefacto, configura SSH desde secretos del Environment y ejecuta el script de deploy. |

El artefacto se construye una vez desde el SHA identificado y no se recompila
en el VPS. El workflow usa permiso `contents: read` y concurrencia
`bookwise-frontend-development` con `cancel-in-progress: false`.

## Configuración requerida en GitHub

Crear/verificar un Environment llamado `development`, limitar sus deployment
branches a `develop`, y agregar los secretos allí (no a nivel global):

- `DEV_SSH_HOST`
- `DEV_SSH_USER`
- `DEV_SSH_PRIVATE_KEY`
- `DEV_SSH_HOST_KEY`

Guardar sólo nombres aquí; nunca copiar valores, claves ni líneas de
`known_hosts`. Confirmar que la cuenta remota tenga acceso al directorio de
releases/incoming de frontend. El nombre del Environment en el YAML no prueba
que exista ni que tenga secretos, reviewers o protección configurados. Estas
opciones deben verificarse por una persona con permisos de administración; la
disponibilidad de reviewers depende del plan/visibilidad del repo.

## Qué hace el deploy

El runner valida el checksum y copia el tar a
`/srv/bookwise/development/incoming/`. El servidor vuelve a comprobar SHA-256,
extrae a una release inmutable bajo
`/srv/bookwise/development/frontend/releases/<UTC>-<sha12>` y comprueba
`index.html`. Luego conmuta `frontend/current` con symlink temporal y rename
atómico, y hace un GET HTTPS local a `/` con SNI/Host de `dev.bookwise.cl`.

Si el smoke falla y hay una release anterior válida, el script devuelve
`current` a esa release y falla el job. La release nueva se conserva para
diagnóstico. En un primer deploy sin release anterior, no hay rollback
automático. Los archivos entrantes se borran sólo cuando el deploy termina con
éxito; no hay limpieza automática de releases antiguas.

Este proceso no cambia la API, la base de datos, Nginx, DNS ni PHP. La prueba de
`/` verifica respuesta básica del sitio; no confirma login, conectividad real
con la API ni recorridos funcionales. Los deploys frontend y API tienen locks
separados, así que pueden ocurrir a la vez y no constituyen una promoción
coordinada de pareja de SHAs.

## Límites y siguiente agente

1. Verificar en GitHub el workflow activo en `develop`, runs, Environment,
   secretos presentes por nombre, branch restrictions y approvals disponibles.
2. Integrar esta feature a `develop` mediante el flujo acordado y confirmar que
   el PR/commit final conserva la señal sólo cuando se quiera desplegar.
3. Antes de solicitar deploy, revisar el SHA API compatible y coordinar ambos
   repositorios si el cambio requiere un contrato nuevo.
4. No configurar producción desde este workflow. Producción requiere workflow,
   Environment, credenciales, aprobación y rollback separados.

No se ha ejecutado este workflow desde este checkout ni se ha probado el deploy
remoto desde esta documentación.
