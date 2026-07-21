# Despliegue

## Confirmado por el repositorio

El repositorio solo contiene configuracion de build Angular en `angular.json` y scripts npm en `package.json`.

`npm run build` ejecuta `ng build`. La configuracion production activa budgets y `outputHashing: all`.

`environment.prod.ts` usa `apiUrl: '/api/v1'`.

## Inferencias razonables

La aplicacion podria desplegarse como frontend estatico Angular y comunicarse con una API bajo el mismo host o proxy relativo `/api/v1`. Esto es una inferencia por la configuracion de produccion.

## Desconocido o no verificable

No hay Dockerfile, pipeline CI/CD, configuracion de hosting, nginx/apache, variables de entorno productivas, scripts de release ni instrucciones de despliegue especificas.

