# Ficha de Captación · RK Palanca Fontestad

PWA móvil para que el equipo registre fichas de captación inmobiliaria y las envíe por correo a la oficina.

## Stack
- React 18 + Vite
- Tailwind CSS
- lucide-react (iconos)
- vite-plugin-pwa (instalable en móvil)
- Función serverless de Vercel (`api/agentes.js`) para servir los datos de agentes solo con PIN válido
- Persistencia local con `localStorage`

## Datos sensibles — cómo funciona
Los datos reales (lista de agentes con teléfono/email, y las credenciales de EmailJS) **no están en el código versionado**. Viven en:
- `src/agentes.js` (gitignored) — array `AGENTES` + `DESTINATARIO`. Copiar la estructura de `src/agentes.example.js`.
- `.env` (gitignored) — credenciales de EmailJS y las variables que usa la función serverless (`PIN_ACCESO`, `DESTINATARIO`, `AGENTES_JSON`). Copiar `.env.example`.

El cliente (lo que corre en el navegador) **nunca** recibe la lista de agentes directamente en el bundle: la pide en tiempo de ejecución a `/api/agentes`, y esa función solo la devuelve si recibe el PIN correcto. Así, alguien que abra la app sin el PIN no puede ver teléfonos ni emails del equipo.

Para generar el valor de `AGENTES_JSON` a partir de `src/agentes.js` (por ejemplo, después de dar de alta o baja a un agente):
```bash
node scripts/print-agentes-env.mjs
```

## Desarrollo
```bash
npm install
npm run dev
```
Nota: `npm run dev` (Vite) no ejecuta las funciones serverless de `/api`. Para probar el flujo de PIN en local, usar `vercel dev` (Vercel CLI), que lee las mismas variables de `.env`.

## Build de producción
```bash
npm run build
npm run preview
```

## Despliegue en Vercel
1. Sube el repo a GitHub.
2. En Vercel: **New Project** → importa el repo.
3. Framework Preset: **Vite** (se detecta solo, la carpeta `api/` se detecta como funciones serverless automáticamente).
4. Build command: `npm run build` · Output: `dist`.
5. En **Project Settings → Environment Variables**, agregar `PIN_ACCESO`, `DESTINATARIO` y `AGENTES_JSON` (los valores reales, generados con el script de arriba). Las `VITE_EMAILJS_*` también van acá.
6. Deploy.

## Acceso del equipo (PIN)
La app no tiene login de usuario — usa un PIN compartido para que la lista de agentes no quede visible a cualquiera que abra el sitio.
- Para que los agentes **no tengan que escribir nada**, se les comparte un link con el PIN incluido: `https://tu-dominio.vercel.app/?pin=EL_PIN`. La app lo detecta, valida solo, y lo recuerda en el dispositivo (no se vuelve a pedir).
- Si cambiás el PIN (`PIN_ACCESO` en Vercel), hay que volver a compartir el link nuevo — los dispositivos que ya tenían el PIN viejo guardado en caché van a seguir funcionando hasta que usen "Actualizar lista de agentes" en Perfil o borren caché.

## Funcionamiento
- PIN de acceso (una vez por dispositivo) → selección de agente (se recuerda en el dispositivo).
- Ficha en 7 secciones con barra de progreso.
- Previsualización del correo y envío directo vía EmailJS, con respaldo `mailto` si falla.
- Historial de enviadas y borradores guardado en el navegador.
- Botón "Actualizar lista de agentes" en Perfil, para refrescar el listado sin redesplegar código cuando cambia el equipo.

## Iconos
Los iconos PWA están en `public/`. Para usar el imagotipo oficial, reemplaza `icon-192.png`, `icon-512.png` y `apple-touch-icon.png` manteniendo los nombres.
