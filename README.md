# Ficha de Captación · RK Palanca Fontestad (v2)

Dos aplicaciones en un mismo despliegue de Vercel, sobre una base de datos Neon:

- **`/`** — PWA móvil para que los agentes registren captaciones en la calle.
- **`/admin`** — panel de oficina para consultar, filtrar y hacer seguimiento.
  Se entra con la cuenta de Google de la agencia, no con contraseña ni PIN.

No hay correo: la ficha viaja del móvil del agente a Postgres, y la oficina la
lee en el panel. Las fotografías van aparte, al Drive de la agencia.

## Cómo funciona

```
Agente (móvil)                  Vercel                        Neon
──────────────                  ──────                        ────
PIN ─────────────────────────▶  /api/agentes  ──────────────▶  (variables de entorno)
Rellena la ficha
  · autoguardado continuo
  · campos según el tipo
Enviar ──────────────────────▶  /api/fichas   ──────────────▶  insert … on conflict
  ✗ sin cobertura → cola local
  ✓ vuelve la red → sale sola

Oficina (/admin)
Entrar con Google ───────────▶  Neon Auth (Better Auth, Fráncfort)
  ↳ JWT en Authorization ────▶  /api/admin    ──────────────▶  select / update
      · firma verificada contra el JWKS
      · email comprobado contra ADMIN_EMAILS
  listar · buscar · filtrar · detalle · estado · nota · CSV
```

## Puesta en marcha

### 1. Base de datos
Con el proyecto de Neon enlazado (`npx neon link`), la `DATABASE_URL` queda en
`.env`. Aplicar el esquema:

```bash
npm run db:esquema
```

No hace falta `psql`: el script usa el propio driver de Neon. Es idempotente
(`create … if not exists`), así que se puede repetir sin miedo. Para aplicar una
migración concreta:

```bash
node --env-file=.env dev/aplicar-esquema.mjs db/migraciones/001-quitar-en-curso.sql
```

Y para comprobar que toda la cadena funciona contra la base de datos real
—guardar una ficha, buscarla, cambiarle el estado y borrarla:

```bash
npm run db:probar
```

Para ver el panel con datos realistas sin esperar a que un agente envíe nada:

```bash
npm run db:prueba          # inserta 3 fichas de ejemplo (piso, chalet y local)
npm run db:prueba:borrar   # las quita
```

Pasan por el handler real, así que recorren la misma validación y el mismo SQL
que una ficha enviada desde el móvil. Van marcadas con `[PRUEBA]` en las notas
internas, que es por donde las localiza el borrado. Los propietarios son
inventados.

### 2. Variables de entorno
Copiar `.env.example` a `.env` (local) y rellenar las mismas en
**Vercel → Settings → Environment Variables**:

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | Conexión a Neon. La integración de Vercel la rellena sola. |
| `PIN_ACCESO` | PIN de los agentes. Largo y alfanumérico. |
| `NEON_AUTH_BASE_URL` · `NEON_AUTH_JWKS_URL` | Servidor de sesiones. Los pone `neon link`. |
| `VITE_NEON_AUTH_BASE_URL` | La misma base, para el navegador (es pública). |
| `ADMIN_EMAILS` | Quién entra al panel. **Sin esto no entra nadie.** |
| `AGENTES_JSON` | Lista del equipo. Generar con `npm run agentes:env`. |

`neon link` deja además `DATABASE_URL_UNPOOLED` y `NEON_BRANCH`, que el código
no usa.

Cuidado con la sintaxis del `.env`: es `CLAVE=valor`, con `=`. Con `:` la
variable se ignora en silencio y el endpoint responde 500.

### 3. Acceso de la oficina
El panel usa **Neon Auth** (Better Auth gestionado, alojado en Fráncfort) con
inicio de sesión de Google. No hay contraseñas ni PIN compartido.

`ADMIN_EMAILS` decide quién entra. Es **obligatoria**: el proveedor de Google
es compartido, así que sin lista cualquier cuenta de Google del mundo pasaría
la autenticación. Sin la variable, el servidor deniega a todo el mundo.

```bash
ADMIN_EMAILS=@inmobiliariapalanca.com        # todo el dominio
ADMIN_EMAILS=julia@empresa.com,rob@empresa.com   # solo estas dos
```

Para quitarle el acceso a alguien: sácalo de `ADMIN_EMAILS`, o desactiva su
cuenta en Google Workspace. Con el PIN compartido de antes había que cambiar el
PIN y avisar a todo el mundo.

**Registrar el dominio de producción**, o el login falla con `invalid domain`:

```bash
npx neon@latest neon-auth domain add https://tu-dominio.vercel.app
npx neon@latest neon-auth domain list
```

`localhost` ya está permitido para desarrollo.

### 4. Desplegar
Framework preset **Vite**, output `dist`. `vercel.json` ya trae las cabeceras de
seguridad y la reescritura de `/admin`.

Los pasos concretos para `captacion2.vercel.app`, con las variables una a una y
las comprobaciones posteriores, están en **[DESPLIEGUE.md](DESPLIEGUE.md)**.

## Desarrollo

```bash
npm install
npm run dev:mock   # ← lo habitual: /api simulada + sesión de oficina simulada
npm run dev:login  # igual, pero con el login real de Google (para probarlo)
npm run dev        # Vite pelado (las llamadas a /api fallarán)
npx vercel dev     # funciones reales contra la Neon de verdad
npm test           # 18 tests
npm run lint
npm run build && npm run preview
```

Con `npm run dev:mock` hay 47 captaciones de ejemplo. El PIN de agentes es
`agentes-2026`, y el panel entra directo con una sesión simulada.

Esa sesión simulada está detrás de `import.meta.env.DEV`, así que en el build
de producción es código muerto y desaparece del bundle — comprobado. El
simulador de `/api` vive en `dev/mock-api.js` y **solo se carga con
`MOCK_API=1`**.

## Estructura

```
db/schema.sql           Esquema de Postgres
api/agentes.js          Lista del equipo, solo con PIN de agente
api/fichas.js           Recibe y guarda una ficha (idempotente por id)
api/admin.js            listar · detalle · actualizar · resumen (sesión Google)
api/_auth.js            PIN en tiempo constante, límite de intentos, body seguro
api/_jwt.js             Verifica el JWT de Neon Auth y aplica ADMIN_EMAILS
api/_ficha.js           Validación y traducción ficha ⇄ fila (probado sin BD)
api/_db.js              Cliente de Neon

src/data/secciones.js   ESQUEMA DE LA FICHA — el archivo que se toca para
                        añadir, quitar o condicionar campos
src/lib/ficha.js        Aplicabilidad, progreso, validación de la ficha
src/lib/validacion.js   DNI, teléfono, CP, año, y números en formato es-ES
src/lib/cola.js         Cola de envío offline con reintentos
src/lib/catastro.js     Consulta al Catastro y relleno automático de la ficha
src/lib/resumen.js      Estructura legible de la ficha (texto y panel)
src/lib/storage.js      Claves, caducidad de la caché, poda del historial
src/screens/            App de agentes
src/admin/              Panel de oficina
src/admin/auth.js       Cliente de Neon Auth + token de sesión
src/components/Logo.jsx Logotipo con variantes claro/oscuro
src/components/Avatar.jsx Foto del agente, con iniciales de respaldo
dev/generar-avatares.mjs Recorta las fotos del equipo a la cara (Vision) → WebP
dev/detectar-caras.swift Detección de caras con el framework Vision de macOS
test/                   18 tests
dev/mock-api.js         Simulador de /api para desarrollo
```

### Autocompletado desde el Catastro
El campo «Referencia catastral» consulta los servicios públicos de la Sede
Electrónica del Catastro (HTTPS y CORS abierto, sin necesidad de proxy) y
rellena hasta 11 campos: calle, número, escalera, planta, puerta, código
postal, población, provincia, superficie construida y año.

Las referencias tienen dos longitudes:

- **20 caracteres** → un inmueble concreto. Rellena directamente.
- **14 caracteres** → la parcela entera. Muestra la lista de unidades (una
  parcela de Colón tiene 10) para que el agente elija la suya.

El dato oficial **sobrescribe** lo que hubiera escrito el agente. La única
excepción es el tipo de inmueble: decide qué campos existen, y el Catastro no
distingue piso de ático ni de chalet, así que solo se propone cuando el uso es
inequívoco (Comercial → Local, Almacén-Estacionamiento → Garaje, Suelo →
Terreno) y el campo está vacío.

Solo se piden datos **no protegidos**: nunca el titular. Los tests usan
respuestas grabadas en `test/fixtures/`, así que no dependen de la red.

> El dominio del Catastro está en `connect-src` del CSP, igual que el servidor
> de Neon Auth. Si se añade cualquier servicio externo al que llame el
> navegador, hay que añadirlo ahí o las llamadas fallan sin aviso visible.

### Añadir o cambiar un campo
Todo en `src/data/secciones.js`:

```js
num("plazas", "Plazas de aparcamiento", { unidad: "nº", tipos: ["Garaje"] }),
num("derramaImporte", "Importe de la derrama", { when: (d) => d.derrama === "Sí" }),
txt("cp", "Código postal", { validate: "cp", required: true }),
```

El formulario, el progreso, la validación, el resumen y el panel se ajustan
solos. La columna `datos` de Postgres es `jsonb`, así que **no hace falta migrar
la base de datos** para añadir un campo.

## Seguridad

- `/api/agentes` y `/api/fichas` (los agentes) usan PIN comparado en **tiempo
  constante**; `/api/admin` (la oficina) exige una sesión de Google válida.
  Los tres: solo POST, **8 intentos por IP cada 10 minutos**, y el secreto
  nunca viaja en la URL ni en query string.
- El JWT del panel se verifica contra el **JWKS público** de Neon Auth y
  después se comprueba el email contra `ADMIN_EMAILS`. Los dos pasos hacen
  falta: el primero prueba que la sesión es auténtica, el segundo que esa
  persona trabaja aquí.
- `vercel.json` aplica CSP, `Referrer-Policy: no-referrer`, `X-Frame-Options`,
  `noindex` y `no-store` en `/api`.
- El listado del panel **no devuelve datos de propietarios**: nombre, teléfono
  y DNI solo se cargan al abrir una ficha concreta.
- La caché de agentes en el móvil **caduca a los 30 días**.
- `insert … on conflict (id)` hace el envío idempotente: la cola puede
  reintentar sin duplicar fichas.

### Compromisos conocidos
- **El PIN va en el enlace** que se comparte con el equipo (`?pin=…`) para que
  no tengan que teclear. Se borra de la barra al instante, pero queda en los
  logs de acceso de Vercel. El siguiente paso sería un token de un solo uso
  canjeado por una cookie de sesión firmada.
- **El PIN se guarda en el móvil** porque la cola offline lo necesita para
  reintentar sin el agente delante.
- **El límite de intentos es por instancia** serverless. Para un límite real y
  compartido: Vercel KV o Upstash.
- **No hay passkeys.** Neon Auth no los ofrece hoy: sus plugins son
  `organization`, `magic_link`, `phone_number`, `email_provider`,
  `email_and_password`, `oauth_providers` y `allow_localhost`. Google es lo más
  parecido disponible — sin contraseña, por persona y revocable.
- **El panel registra quién cambió cada ficha** (`actualizada_por`), pero no
  quién la consultó. Para eso haría falta un registro de accesos.

## Protección de datos
Las fichas contienen nombre, teléfono y **DNI** de los propietarios.

- Viven en Neon (elegir región europea) y, mientras no se envían, en el móvil
  del agente (últimas 100 fichas).
- Perfil incluye «Borrar todos los datos del dispositivo».
- Pendiente de decidir por la agencia: base legal e información al propietario
  en el momento de la captación, plazo de conservación, y DPA firmado con Neon.
- Las tipografías se cargan desde Google Fonts (CDN de un tercero). Para
  eliminar esa transferencia, self-hostear Montserrat en `public/fonts` y
  cambiar el `<link>` de `index.html` por un `@font-face`.

## Marca
El logotipo oficial está en `public/logos/` en cuatro variantes (vertical y
horizontal × tinta y blanco). `<Logo>` elige sola según `prefers-color-scheme`,
o se le fuerza con `tema="tinta"` / `tema="blanco"`.

El naranja corporativo es **`#cf731c`**, el del propio logotipo.

La paleta de grises sigue los *System Colors* de Apple (`ios-*` en
`tailwind.config.js`): en claro los fondos son grises muy suaves (`#f2f2f7`)
sobre superficies blancas, y en oscuro nunca se usa negro puro — fondo
`#1c1c1e`, tarjetas `#2c2c2e`, elevadas `#3a3a3c`. El negro del logotipo se
reserva para tipografía, no para bloques grandes.

Las etiquetas de estado usan fondo tintado + texto oscuro en vez de color
sólido con texto blanco: el naranja de marca sobre blanco solo da 3,4:1 y no
pasa WCAG AA.

### Avatares del equipo
Las fotos originales van en `fotos-equipo/` (no se versiona). Para regenerar
los avatares:

```bash
npm run avatares
```

Localiza la cara con el framework Vision de macOS, recorta un cuadrado
centrado en ella y guarda `public/avatars/<id>.webp` a 192×192 (~8 KB cada
uno). Si falta el archivo de alguien, la interfaz cae a sus iniciales.

> Los avatares se sirven desde `public/`, que **no está detrás del PIN**:
> quien conozca la URL puede descargarlos. Son fotos corporativas, pero
> conviene saberlo.
