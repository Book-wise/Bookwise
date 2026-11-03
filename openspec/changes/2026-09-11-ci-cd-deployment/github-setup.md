# Checklist del administrador — GitHub para QA

> Acciones manuales del administrador del repositorio. No fueron aplicadas en esta sesión.

## Bloqueo actual

La sesión local no puede consultar ni modificar GitHub: la autenticación de `gh` reporta un token inválido.
La información siguiente es el contrato requerido, no el estado confirmado de la organización.

## 1. Confirmaciones necesarias

- [ ] Confirmar cuál será la rama de integración que alimentará CI.
- [ ] Confirmar que Sebacirk puede crear workflows y abrir el PR correspondiente.
- [ ] Confirmar quién puede administrar environments, secrets y branch protection.
- [ ] Confirmar si el plan de GitHub permite required reviewers para el environment `qa`.
- [ ] Confirmar política de retención de artefactos y logs de Actions.

## 2. Environment `qa`

Crear un environment llamado exactamente `qa`.

Protecciones recomendadas:

- Required reviewers: al menos una persona distinta de quien dispara el deploy, si el plan lo permite.
- Restringir ramas/tags de despliegue a la rama de integración acordada.
- No permitir que PRs desde forks accedan a secretos de despliegue.
- Mantener el deploy inicialmente manual.

## 3. Variables no secretas

| Nombre | Valor esperado | Estado |
|---|---|---|
| `QA_SSH_HOST` | IP o hostname administrado de QA | Configurar |
| `QA_SSH_PORT` | `22`, salvo decisión distinta | Confirmar |
| `QA_SSH_USER` | `deploy` | Crear primero en servidor |
| `QA_BASE_URL` | URL canónica HTTPS de QA | Falta definir/verificar |
| `QA_FRONTEND_ROOT` | `/srv/bookwise/frontend` | Configurar tras bootstrap |

No codificar estos valores directamente en el workflow cuando pertenezcan al environment.

## 4. Secretos

| Nombre | Contenido |
|---|---|
| `QA_SSH_KEY` | Clave privada dedicada del usuario `deploy` |
| `QA_SSH_KNOWN_HOSTS` | Línea de host key validada fuera del canal de despliegue |

La host key no debe obtenerse y confiarse automáticamente dentro del mismo workflow mediante
`ssh-keyscan`, porque eso elimina la verificación de identidad que pretende aportar `known_hosts`.

## 5. Permisos del workflow

Configurar por defecto:

```yaml
permissions:
  contents: read
```

No conceder `contents: write`, `packages: write`, administración ni tokens personales salvo una necesidad
demostrada. El deploy necesita leer artefactos y conectarse por SSH; no necesita escribir en GitHub.

## 6. Branch protection

Aplicar después de que Sebacirk entregue CI verde y estable:

- [ ] Requerir PR para integrar.
- [ ] Requerir el check de tests.
- [ ] Requerir el check de build productivo.
- [ ] Requerir rama actualizada antes de merge si el flujo del equipo lo soporta.
- [ ] Bloquear force-push y eliminación de la rama protegida.
- [ ] Definir explícitamente quién puede omitir protecciones.

No marcar un check inexistente o permanentemente rojo como requerido: bloquearía todo el flujo sin aportar
seguridad real.

## 7. Evidencia que debe devolver el administrador

Sin compartir valores secretos:

- Nombre de la rama de integración.
- Nombre exacto del environment creado.
- Confirmación de variables presentes.
- Confirmación de secretos presentes, mostrando solo sus nombres.
- Lista de required reviewers o indicación de que el plan no lo soporta.
- Lista de checks requeridos en branch protection.
