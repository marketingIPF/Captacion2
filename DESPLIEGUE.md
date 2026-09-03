# Despliegue en captacion2.vercel.app

Estado a día de hoy:

| | |
|---|---|
| Proyecto Vercel | `captacion2` · framework Vite · Node 24 |
| Dominio | https://captacion2.vercel.app |
| Repo enlazado | `marketingIPF/Captacion2` — **público** |
| Base de datos | Neon `silent-mouse-41968108`, rama `production`, esquema aplicado |
| Neon Auth | Better Auth en Fráncfort · dominio de producción ya registrado |

## Antes de subir nada: el repositorio es público

Al hacer push, el repo pasaría a contener `public/avatars/` — **las fotos de las
20 personas del equipo, en un repositorio que cualquiera puede clonar**. Además
su historial ya expone nombres, emails y teléfonos de la plantilla (commits
`ed22d0a`…`3d73e38`, anteriores a «Sacar datos sensibles del código
versionado»; borrarlos en un commit posterior no los quita del historial).

Lo más sencillo que arregla las dos cosas a la vez:

> GitHub → repo `Captacion2` → **Settings** → abajo del todo, *Danger Zone* →
> **Change repository visibility** → *Make private*.

Vercel sigue desplegando igual desde un repo privado. Si tiene que seguir
siendo público, hay que reescribir el historial con `git filter-repo` y forzar
el push, y aun así las copias ya clonadas no se recuperan.

## 1. Variables de entorno en Vercel

**Settings → Environment Variables**, entorno *Production* (y *Preview* si
queréis que las ramas funcionen). Los valores están en el `.env` local.

| Variable | De dónde sale |
|---|---|
| `DATABASE_URL` | del `.env` (la puso `neon link`) |
| `PIN_ACCESO` | el PIN de los agentes |
| `AGENTES_JSON` | `npm run agentes:env` |
| `NEON_AUTH_BASE_URL` | del `.env` |
| `NEON_AUTH_JWKS_URL` | del `.env` |
| `VITE_NEON_AUTH_BASE_URL` | mismo valor que `NEON_AUTH_BASE_URL` |
| `ADMIN_EMAILS` | `@inmobiliariapalanca.com` |

No hace falta subir `PIN_ADMIN` (ya no se usa), ni `DATABASE_URL_UNPOOLED`,
`NEON_BRANCH` ni las que empiezan por `VITE_EMAILJS_` de la versión anterior:
**esas conviene borrarlas** del proyecto para no dejar credenciales vivas.

> `VITE_NEON_AUTH_BASE_URL` acaba en el bundle del navegador. Es correcto: es
> una URL pública. Las demás **no** llevan prefijo `VITE_` a propósito, para que
> Vite nunca las incluya en el código del cliente.

## 2. Subir el código

El contenido de `captacion-v2/` pasa a ser la raíz del repo. Si preferís no
tocar el repo viejo, la alternativa es crear uno privado nuevo y reapuntar el
proyecto de Vercel (**Settings → Git → Connect Git Repository**), conservando
el dominio.

Build command `npm run build`, output `dist`. La carpeta `api/` se detecta sola
como funciones serverless.

## 3. Comprobar después del despliegue

1. `https://captacion2.vercel.app/?pin=EL_PIN` → debe entrar directo al selector
   de agente, con las 20 fotos, y el PIN debe desaparecer de la barra.
2. Rellenar una ficha de prueba y enviarla.
3. `https://captacion2.vercel.app/admin` → «Entrar con Google» con la cuenta de
   Julia → debe aparecer la ficha de prueba.
4. Borrar la ficha de prueba desde el panel.

Si el login falla con **`invalid domain`**, es que el dominio no está en la
lista de confianza:

```bash
npx --yes neon@latest neon-auth domain list --project-id silent-mouse-41968108
```

## Aviso: la app antigua sigue en los móviles

Los agentes que ya tengan instalada la versión anterior conservan en su
navegador las claves `ipf_*` de localStorage: sus borradores y su historial de
fichas enviadas, **con nombre, teléfono y DNI de propietarios**. La app nueva
usa claves `rk2_*`, así que no los ve ni los borra.

No se limpian solos. Si queréis, se puede añadir una limpieza única al arrancar
la app nueva — pero borraría también cualquier borrador antiguo sin enviar, así
que es una decisión vuestra.
