# Spec — Contrato del pipeline de despliegue (frontend)

> Contrato entre el repositorio y el servidor QA. Los valores marcados **(por confirmar)** dependen de la
> inspección de solo lectura del servidor y deben validarse antes de ejecutar el primer despliegue.

## 1. Layout en el servidor

```
/srv/bookwise/
├── frontend/
│   ├── releases/
│   │   ├── 20260911T034500Z-a1b2c3d/     # timestamp UTC + SHA corto
│   │   └── 20260910T191200Z-9f8e7d6/
│   └── current -> releases/20260911T034500Z-a1b2c3d   # symlink, raíz de Nginx
├── releases/
│   └── 20260820T204436Z/                                # release conjunta heredada
└── current -> releases/20260820T204436Z                 # backend heredado, no se toca ahora
```

- `current` es **siempre** un symlink. Nunca se escribe dentro de la release activa.
- Propietario objetivo del árbol frontend: `deploy:www-data`. Directorios `755`, archivos `644`.
- Nginx sirve hoy `root /srv/bookwise/current/frontend/browser;`; el bootstrap debe cambiarlo a
  `/srv/bookwise/frontend/current/browser` manteniendo el backend en su ruta actual.

## 2. Etapas del pipeline

### CI — en cada push y pull request
| Paso | Comando | Bloquea |
|---|---|---|
| Instalar | `npm ci` | Sí |
| Tests | `npx ng test --no-watch` | No, hasta sanear los 38 rojos |
| Build | `npx ng build --configuration production` | Sí |
| Fuga de URL de dev | `! grep -rq "127.0.0.1:9999" dist/bookwise/browser/` | Sí |

La última verificación es una regresión explícita del defecto de `fileReplacements`: si alguien vuelve a
romper la sustitución de environment, el pipeline lo detiene antes de publicar.

### Deploy QA — `workflow_dispatch` y push a la rama de integración
1. **Construir** en el runner. Node 22, `npm ci` desde lockfile. Nunca `npm install`, nunca build en el servidor.
2. **Empaquetar** `dist/bookwise/browser/` como `frontend-<TIMESTAMP>-<SHA>.tar.gz`.
3. **Registrar** el destino de la release activa para rollback. Las releases retenidas son la recuperación del
   frontend; no se genera un respaldo comprimido redundante en cada despliegue.
4. **Base de datos** — no se toca. La estrategia de respaldo/migración pertenece a la fase de API.
5. **Subir** a `releases/<TIMESTAMP>-<SHA>/` vía `rsync` sobre SSH. La release se sube completa **antes** de
   activarse; una subida interrumpida nunca queda publicada.
6. **Verificar** que la release contenga `index.html` y que su tamaño sea razonable.
7. **Activar** con intercambio atómico:
   `ln -sfn releases/<nueva> current.tmp && mv -T current.tmp current`
   `mv -T` sobre un symlink es atómico: no existe instante en que Nginx sirva un directorio inexistente.
8. **Recargar** Nginx solo si cambió su configuración. Para contenido estático no hace falta.
9. **Smoke test** desde el runner, contra la URL pública:
   - `GET /` devuelve 200 y el HTML contiene `<app-root` o el selector raíz.
   - El hash del bundle principal servido coincide con el de la release recién publicada.
   - `GET /api/v1/...` responde (verifica que Nginx sigue enrutando la API).
10. **Rollback automático** si el smoke test falla: reapuntar `current` a la release anterior y volver a
    verificar. El job termina en rojo aunque el rollback tenga éxito.
11. **Podar** releases: conservar las 5 más recientes. Respaldos de código: conservar 10.

### Rollback manual — `workflow_dispatch`
Parámetro: identificador de release (o `previous`). Reapunta el symlink y corre el smoke test.
No recompila, no descarga nada, no toca la base de datos.

## 3. Secretos y variables

| Nombre | Tipo | Contenido |
|---|---|---|
| `QA_SSH_HOST` | variable | Host administrado de QA; la IP actual se confirma al configurar |
| `QA_SSH_USER` | variable | `deploy` **(por confirmar: el usuario debe crearlo el administrador)** |
| `QA_SSH_KEY` | secreto | Clave privada **dedicada al despliegue**. No reutilizar `bookwise_platform`. |
| `QA_SSH_KNOWN_HOSTS` | secreto | Huella del host, para no usar `StrictHostKeyChecking=no` |
| `QA_BASE_URL` | variable | URL canónica HTTPS para el smoke test **(pendiente de definir/verificar)** |

Todos como secretos/variables del **entorno** `qa`, no del repositorio, una vez que exista el entorno protegido.

Permisos del workflow: `contents: read` únicamente. No se concede escritura al `GITHUB_TOKEN`.

## 4. Contrato del usuario de despliegue

La cuenta `deploy` necesita, y solo necesita:
- Escritura en `/srv/bookwise/frontend/releases/` y capacidad acotada para reemplazar
  `/srv/bookwise/frontend/current`.
- Lectura del resto de `/srv/bookwise`.
- **Sin** `sudo` general. Si el despliegue llegara a requerir `systemctl reload nginx`, se concede esa única
  orden vía `sudoers` acotado; hoy no se requiere.
- Shell no interactiva es suficiente para `rsync` y los comandos de activación.

## 5. Invariantes

- El servidor nunca compila. Recibe artefactos.
- La release activa nunca se modifica en sitio; publicar siempre crea un directorio nuevo.
- Las releases retenidas permiten recuperar el frontend; un rollback de código no restaura datos.
- Un smoke test fallido revierte, y de todos modos marca el despliegue como fallido.
- Ningún secreto se escribe en el YAML, en logs ni en el repositorio.
- El pipeline no altera DNS, TLS, firewall ni configuración de MySQL.
