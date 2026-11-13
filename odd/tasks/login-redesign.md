# Login — proveedores de identidad y acceso sin contraseña

Diseño: `design/login/` (3 artboards; elegido `01-split-brand.html`). Traído del repo del API el
2026-11-13 junto con sus comentarios. Implementación: PR #54 (`slice/07-login`).

## Specs

- **S1 (usuario, verbatim, sesión previa):** «ese login si puedes dejarlo implementado ese diseño estaba
  correcto» — implementar el artboard elegido tal como está; no rediseñar.
- **S2 (usuario, verbatim, 2026-11-13):** «quiero que google apple y facebook sean iconos con sus
  respectivos colores de fondo, es decir quiero que caigan en una linea hoy ocupan 3, al ser botones con
  texto comen mucho espacio, eso se lo dejas al diseño» — los tres proveedores pasan a **icono solo**, con
  su color de marca de fondo, y los tres en **una línea**.
- **S3 (contrato del API, ver `odd/tasks/email-automation.md`):** el front no envía correo. Magic link son
  `POST /auth/magic-link` (siempre 202, sin revelar si el correo existe) y `POST /auth/magic-link/consume`.
  Los callbacks OAuth todavía no existen. **Fuente visual del flujo magic link** (sesión del API):
  `design/login/02-magic-link-first.html` del repo del API, commit `b56db72` — incluye el estado «revisa tu
  correo» con contador de reenvío de 30 s, proveedores como íconos y «prefiero usar mi contraseña» plegado.
  La copia en este repo ya está sincronizada con ese commit.
- **S4 (decisión vigente):** mientras los endpoints no existan, los caminos nuevos se renderizan
  **deshabilitados con su nota**, no se ofrecen botones que fallan.

## Tasks

| # | Tarea | Specs | Estado |
|---|---|---|---|
| L1 | Implementar el artboard elegido en el login real (panel de marca, jerarquía de entrada, i18n) | S1 | ✅ hecho (PR #54) |
| L2 | Spec que fija los caminos pendientes deshabilitados y el submit de correo/contraseña intacto | S1, S4 | ✅ hecho (PR #54) |
| L3 | Traer `design/login/` a este repo y abrir el canvas acá | S1 | ✅ hecho |
| L4 | **Diseño**: proveedores como icono solo con color de marca, los tres en una línea | S2 | ✅ hecho en `01-split-brand.html` (grid de 3 columnas, `aria-label` + `sr-only`) |
| L5 | Llevar L4 al `login.component.html`: botones icono-only en una fila (`grid-template-columns: repeat(3,1fr)`), `aria-label` + `title` por proveedor, Google blanco con borde, Apple negro, Facebook `#1877F2` | S2 | ✅ hecho |
| L6 | Habilitar magic link cuando el API lo exponga: consumir 202 y navegar al estado «revisa tu correo» **según `02-magic-link-first.html`** (contador de reenvío 30 s, «prefiero usar mi contraseña» plegado) + ruta de consumo del token | S3, S4 | ⏳ pendiente (bloqueado por el API) |
| L7 | Habilitar los proveedores cuando existan los callbacks OAuth | S3, S4 | ⏳ pendiente (bloqueado por el API) |

## Log

- **L1 (2026-11-13, usuario, verbatim):** «ese login si puedes dejarlo implementado ese diseño estaba
  correcto». Recuperado de la rama `feat/login-redesign` (commit `37be40a`, sesión previa sin publicar) y
  llevado a PR #54 sobre `develop` ya mergeado (build OK, 1110/1110 tests).
- **L2 (2026-11-13, usuario, verbatim):** «pone para lo que debemos hacer mañana, que quiero que google
  apple y facebook sean iconos con sus respectivos colores de fondo, es decir quiero que caigan en una
  linea hoy ocupan 3, al ser botones con texto comen mucho espacio, eso se lo dejas al diseño.» El diseño
  se resuelve hoy (3 columnas iguales, icono solo, Google blanco con borde, Apple negro, Facebook
  `#1877F2`, label accesible por `aria-label` + `sr-only`); el código queda para mañana como L5.
- **L3 (2026-11-13, hallazgo de sesión):** el artboard **no se había perdido**: las tres direcciones
  viven en `Bookwise-API/design/login/` (`01-split-brand`, `02-magic-link-first`, `03-provider-first`) y
  el front tenía la implementación sin publicar en `feat/login-redesign`. El front no tenía ninguna
  carpeta `design/login`; se copió acá para que el canvas del front pueda mostrarla.

- **L4 (2026-11-13, coordinación con la sesión del API):** el artboard `01-split-brand.html` **ya estaba
  implementado** por esa sesión en la rama `feat/login-redesign` (commit `37be40a`, worktree aparte, nunca
  publicada). Acá se recuperó con `cherry-pick -x` a `slice/07-login` → **PR #54**, así que no se duplica
  trabajo. Acuerdo de no pisarse: los archivos `login.component.{html,scss}` y las claves `auth.login.*`
  se tocan avisando antes; la sesión del API pidió que le avisemos si vamos a escribir las pantallas de
  magic link. Estado de hoy: magic link **no** se implementa hasta que existan los endpoints (S4), y lo
  que sigue en esos archivos es L5 (proveedores icono-only en una línea).

- **L5 (2026-11-13, implementación del pedido de S2):** `login.component.html` y `.scss` pasan los tres
  proveedores a **icono solo en una línea** (antes tres filas con etiqueta de texto, que comían el alto
  del formulario). Los botones siguen **deshabilitados** por S4. La etiqueta accesible viaja en
  `aria-label` + `title`; el spec nuevo lo fija: además de que los tres estén deshabilitados, verifica
  que cada botón tenga su `aria-label` y que no quede texto visible adentro, que es justo lo que se
  rompería si alguien los deja icon-only sin etiqueta.
