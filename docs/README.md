# Documentacion tecnica de Bookwise

## Proposito

Esta documentacion describe el estado actual del repositorio Bookwise tal como esta implementado. Su objetivo es servir como levantamiento tecnico y funcional verificable desde el codigo, no como especificacion futura ni como evaluacion de calidad.

## Mapa de documentos

- [business/overview.md](business/overview.md): descripcion general del dominio observado.
- [business/domain-concepts.md](business/domain-concepts.md): conceptos de dominio identificados en tipos, servicios y pantallas.
- [business/business-rules.md](business/business-rules.md): reglas confirmadas por codigo y contratos comentados.
- [architecture/overview.md](architecture/overview.md): arquitectura frontend y patrones transversales.
- [architecture/components.md](architecture/components.md): componentes, layouts, servicios y utilidades.
- [architecture/data-model.md](architecture/data-model.md): modelo de datos esperado por el frontend.
- [architecture/integrations.md](architecture/integrations.md): integraciones tecnicas.
- [architecture/runtime-flows.md](architecture/runtime-flows.md): flujos de ejecucion relevantes.
- [product/features.md](product/features.md): funcionalidades visibles por area.
- [product/user-roles.md](product/user-roles.md): roles y rutas asociadas.
- [product/user-flows.md](product/user-flows.md): flujos de usuario observados.
- [engineering/repository-structure.md](engineering/repository-structure.md): estructura del repositorio.
- [engineering/local-development.md](engineering/local-development.md): ejecucion local segun scripts y configuracion.
- [engineering/configuration.md](engineering/configuration.md): configuracion de Angular, TypeScript y entorno.
- [engineering/testing.md](engineering/testing.md): pruebas presentes.
- [engineering/deployment.md](engineering/deployment.md): informacion de build/despliegue disponible.
- [engineering/dependencies.md](engineering/dependencies.md): dependencias declaradas.
- [inventory/routes.md](inventory/routes.md): rutas frontend.
- [inventory/api-endpoints.md](inventory/api-endpoints.md): endpoints consumidos por `ApiService`.
- [inventory/background-jobs.md](inventory/background-jobs.md): trabajos en segundo plano observados en el frontend.
- [inventory/external-services.md](inventory/external-services.md): servicios externos e integraciones.
- [open-questions.md](open-questions.md): informacion desconocida, inferencias y puntos pendientes.

## Alcance del levantamiento

Se revisaron estructura de archivos, configuracion Angular/TypeScript, `package.json`, README existente, rutas, modelos, servicios, interceptores, guards, componentes de autenticacion, layouts, pantallas admin/provider, dialogos de reservas/bloqueos/pagos, utilidades compartidas, assets listados y pruebas unitarias existentes.

No se ejecutaron instalaciones, builds, tests, migraciones ni servidores. No se inspecciono ningun backend externo. La documentacion de API describe lo que este frontend consume o espera, no la implementacion real del backend.

## Fecha y commit analizado

- Fecha del levantamiento: 2026-06-26.
- Commit analizado: `c794506`.

## Principales areas no verificadas

- Comportamiento real de la API Laravel referenciada por `environment.apiUrl`.
- Contratos reales del backend frente a comentarios en tipos TypeScript.
- Resultado de `npm run build` y `npm test`, porque no fueron ejecutados.
- Despliegue productivo, servidor web, CI/CD o infraestructura, porque no hay archivos especificos en el repositorio que lo describan.
- Existencia de procesos backend, colas o jobs fuera del frontend.

## Mantenimiento

Antes de completar cambios que alteren comportamiento, arquitectura, configuracion, datos, integraciones, despliegue o experiencia de usuario, revisar esta carpeta `/docs`.

Actualizar solo los documentos afectados por el cambio. La documentacion debe reflejar el estado real del repositorio y distinguir hechos confirmados, inferencias y asuntos desconocidos. No agregar documentacion generica, especulativa ni redundante.

