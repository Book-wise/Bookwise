# Checklist de infraestructura — bootstrap QA del frontend

> Instrucciones para el administrador. No ejecutar hasta que los workflows hayan sido revisados y exista
> autorización de cambio sobre QA.

## Estado que debe preservarse

- Symlink actual: `/srv/bookwise/current -> /srv/bookwise/releases/20260820T204436Z`.
- Frontend actual: `/srv/bookwise/current/frontend/browser`.
- Backend actual: `/srv/bookwise/current/backend/public/index.php`.
- Nginx, MySQL y PHP-FPM activos.
- `/` y `/up` responden 200 localmente.

No leer, copiar ni versionar `/srv/bookwise/CREDENTIALS.md` ni el `.env` del backend.

## Cambios requeridos, sujetos a autorización

1. Crear el usuario técnico `deploy` con autenticación por clave dedicada.
2. Crear `/srv/bookwise/frontend/releases`.
3. Sembrar una release inicial con una copia exacta del frontend actualmente activo.
4. Crear `/srv/bookwise/frontend/current` apuntando a esa release.
5. Asignar al usuario `deploy` solo el árbol del frontend.
6. Cambiar el `root` Nginx a `/srv/bookwise/frontend/current/browser`.
7. Mantener sin cambios la ruta PHP del backend.
8. Validar configuración, recargar Nginx y ejecutar smoke tests.

## Preflight obligatorio

- [ ] Ventana y responsable del cambio confirmados.
- [ ] Configuración Nginx vigente respaldada de manera recuperable.
- [ ] Destino real del symlink actual registrado.
- [ ] Release inicial contiene `browser/index.html`.
- [ ] Propietario y permisos revisados.
- [ ] Clave `deploy` probada sin acceso general de root.
- [ ] Comandos de reversión preparados antes de recargar Nginx.

## Validación posterior

- [ ] `nginx -t` correcto.
- [ ] `/` = 200 y carga el selector Angular.
- [ ] Bundle principal = 200.
- [ ] `/up` = 200.
- [ ] Backend sigue ejecutándose desde la release anterior conjunta.
- [ ] Usuario `deploy` puede crear una release y mover el symlink del frontend.
- [ ] Usuario `deploy` no puede escribir en backend, configuración Nginx ni base de datos.

## Rollback del bootstrap

Si falla cualquier validación:

1. Restaurar el `root` Nginx anterior: `/srv/bookwise/current/frontend/browser`.
2. Validar la configuración.
3. Recargar Nginx.
4. Repetir `/`, bundle principal y `/up`.
5. Conservar la evidencia del fallo sin borrar la release candidata hasta terminar el diagnóstico.
