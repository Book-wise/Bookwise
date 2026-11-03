# Propuesta — Estrategia CI/CD y despliegue estilo Capistrano (frontend)

> Sesión 2026-09-11. Rama `feature/ci-cd-deployment`. Alcance de esta fase: **solo Bookwise (frontend)**.
> `Bookwise-API` queda fuera hasta que el administrador otorgue rol `Maintain` en GitHub.

## Contexto / por qué

El ambiente QA fue desplegado a mano el 2026-08-20 y está operativo por HTTP. La inspección de solo lectura
del 2026-09-11 confirmó una única release conjunta y un symlink `current`, pero no encontró pipeline,
releases independientes, usuario de despliegue ni rollback probado.

Al inspeccionar el checkout en `develop` aparecieron tres hechos que condicionan el diseño:

1. **El build de producción publicaba la URL de desarrollo.** `angular.json` no declaraba `fileReplacements`,
   por lo que `@env/environment` resolvía siempre a `environment.ts` y el bundle embebía
   `http://127.0.0.1:9999/api/v1`. El despliegue de agosto funcionó porque el archivo se parchó a mano en el
   servidor — exactamente el "fileReplacements usado por el frontend" que el runbook pide incorporar al repo.
   Un despliegue automatizado desde un checkout limpio habría publicado un frontend incapaz de hablar con la API.
2. **La suite de tests está roja en `develop`:** 38 tests fallan de 493 (4 archivos). Un pipeline que bloquee
   por tests no puede activarse como obligatorio hasta sanear esto.
3. **El servidor tiene 961 MiB de RAM y 1 GiB de swap.** El build de Angular no debe ejecutarse en el
   servidor. El OOM mencionado en antecedentes no fue verificado nuevamente en esta sesión.

## Decisiones de diseño

### Construir en CI, nunca en el servidor
El runner de GitHub Actions compila y publica un artefacto inmutable; el servidor solo recibe archivos ya
construidos. Evita la presión de memoria documentada y hace que lo probado sea exactamente lo desplegado.

### Un solo artefacto promovido entre ambientes
`environment.prod.ts` usa `apiUrl: '/api/v1'` — una ruta relativa servida por el mismo Nginx. QA y producción
no difieren en tiempo de build, sino en configuración del servidor. Por eso **no** se crea una configuración
`qa` separada: el mismo bundle que se valida en QA es el que se promueve, sin recompilar.

### Estructura Capistrano con releases inmutables
Publicación por directorio con timestamp y activación por intercambio atómico de symlink. El rollback es
volver a apuntar el symlink a la release anterior: segundos, sin recompilar, sin depender de la red.

### Releases como mecanismo de recuperación del frontend
Las releases inmutables retenidas permiten rollback sin generar un `.tar.gz` redundante en cada publicación.
El respaldo de base de datos pertenece a la futura estrategia del backend: un rollback de frontend nunca debe
restaurar datos ni perder reservas creadas después del release.

### Separar el symlink de frontend del de backend
La inspección confirmó que `current/` contiene `frontend/` y `backend/` bajo un mismo symlink. Como los
repositorios son independientes, la primera transición crea `frontend/current` y cambia solamente el `root`
de Nginx; el backend conserva temporalmente `/srv/bookwise/current/backend`. Su separación queda para una
fase propia.

## Alcance

### 1) Repositorio — hecho en esta sesión
- `angular.json`: se agrega `fileReplacements` a la configuración `production`.
  Verificado: el bundle ya no contiene `127.0.0.1:9999` y publica `apiUrl:"/api/v1"`.

### 2) Repositorio — especificado, pendiente de implementación por Sebacirk
- Workflow `ci.yml`: `npm ci` → tests → build de producción, en push y PR. Informativo hasta sanear la suite.
- Workflow `deploy-qa.yml`: build → artefacto → respaldo → publicación → activación → smoke test, con
  `workflow_dispatch` y entorno `qa` protegido.
- Job de rollback por `workflow_dispatch`, con la release destino como parámetro.

### 3) Servidor — inspeccionado en lectura, cambios pendientes de autorización
- Layout conjunto, Nginx, recursos, servicios y smoke local fueron verificados el 2026-09-11.
- Alta de un usuario `deploy` sin privilegios y de su clave pública: lo ejecuta el administrador, no este pipeline.

### 4) Saneamiento previo al bloqueo por CI — responsabilidad de Sebacirk
- 38 tests rojos en 4 archivos, concentrados en `full-calendar.component.spec.ts` (32).
  Se corrigen antes de marcar el workflow de CI como check obligatorio.

## Entregables de diseño

- `implementation-plan.md`: arquitectura, workflows, transición y criterios de aceptación.
- `tests-handoff.md`: diagnóstico reproducido de la suite para el responsable del código.
- `github-setup.md`: acciones manuales del administrador del repositorio.
- `server-handoff.md`: bootstrap y rollback para el administrador de QA.

## Fuera de alcance (ahora)

- `Bookwise-API`: sin permiso de escritura en GitHub (`READ`). La rama `feature/ci-cd-deployment` no existe allí.
- DNS, HTTPS/TLS y rotación de credenciales: son de infraestructura, previos y ortogonales al pipeline.
- Monitoreo y backups automáticos programados por cron: el pipeline respalda en cada despliegue, que no
  reemplaza un backup periódico con retención.
- Migraciones de base de datos y su respaldo previo: llegan con la fase de la API.

## Riesgos

- **Permisos en GitHub.** Los entornos de despliegue con aprobación requieren rol `Admin`; hoy hay `Maintain`
  en `Bookwise`. Sin entorno protegido, el secreto de la clave SSH queda como secreto de repositorio, con
  menos control sobre quién puede dispararlo.
- **Clave SSH de despliegue.** Debe ser una cuenta dedicada, limitada a `/srv/bookwise` y a los comandos
  necesarios. No debe reutilizarse `bookwise_platform`, que es una clave administrativa personal.
- **Retención de releases.** Hay aproximadamente 18 GiB libres, pero conservar releases sin poda puede llenar
  el disco. Se define retención de 5 y limpieza al final de cada despliegue exitoso.
