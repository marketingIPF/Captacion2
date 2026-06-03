# Ficha de Captación · RK Palanca Fontestad

PWA móvil para que el equipo registre fichas de captación inmobiliaria y las envíe por correo a la oficina.

## Stack
- React 18 + Vite
- Tailwind CSS
- lucide-react (iconos)
- vite-plugin-pwa (instalable en móvil)
- Persistencia local con `localStorage`

## Desarrollo
```bash
npm install
npm run dev
```

## Build de producción
```bash
npm run build
npm run preview
```

## Despliegue en Vercel
1. Sube el repo a GitHub.
2. En Vercel: **New Project** → importa el repo.
3. Framework Preset: **Vite** (se detecta solo).
4. Build command: `npm run build` · Output: `dist`.
5. Deploy.

## Funcionamiento
- Selección de agente (se recuerda en el dispositivo).
- Ficha en 7 secciones con barra de progreso.
- Previsualización del correo y envío vía `mailto` a **julia@inmobiliariapalanca.com**.
- Historial de enviadas y borradores guardado en el navegador.

## Cambiar el destinatario o el método de envío
- Destinatario: constante `DESTINATARIO` en `src/App.jsx`.
- Método de envío: función `abrirCorreo()` en `src/App.jsx`. Para envío automático sin abrir el cliente de correo (o adjuntar PDF), sustituir esa función por una llamada a EmailJS o a un backend propio.

## Iconos
Los iconos PWA están en `public/`. Para usar el imagotipo oficial, reemplaza `icon-192.png`, `icon-512.png` y `apple-touch-icon.png` manteniendo los nombres.
