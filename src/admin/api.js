import { tokenDeSesion, olvidarToken } from "./auth.js";

/* Cliente del panel. La sesión viaja en la cabecera Authorization. */
export async function llamar(accion, extra = {}) {
  const enviar = async (token) =>
    fetch("/api/admin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ accion, ...extra }),
    });

  let r = await enviar(await tokenDeSesion());

  /* Un 401 casi siempre es un token caducado: se pide uno nuevo y se reintenta
     una vez, para que a nadie se le corte el trabajo a media tarde. */
  if (r.status === 401) {
    olvidarToken();
    const fresco = await tokenDeSesion({ forzar: true });
    if (fresco) r = await enviar(fresco);
  }

  const cuerpo = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(cuerpo.error || `Error ${r.status}`);
    err.status = r.status;
    throw err;
  }
  return cuerpo;
}

/* Las fases del proceso, en el orden en que ocurren. "Baja" es la salida.
   `fuerte` es la versión oscura del color, para cuando el texto va en blanco
   encima: el naranja de marca sobre blanco solo da 3,4:1 y no pasa WCAG AA.
   Las etiquetas usan fondo tintado + texto fuerte, al estilo de los badges de
   Apple, que pasa AA de sobra en claro y en oscuro. */
export const ESTADOS = [
  { key: "nueva",          label: "Nueva",              color: "#cf731c", fuerte: "#a95a12", claro: "#f0a25a" },
  { key: "agendada_fotos", label: "Agendada para fotos", color: "#af52de", fuerte: "#7a3aa8", claro: "#d9a2f0" },
  { key: "pendiente",      label: "Pendiente",          color: "#007aff", fuerte: "#0058b8", claro: "#6fb4ff" },
  { key: "publicada",      label: "Publicada",          color: "#248a3d", fuerte: "#1e7a34", claro: "#5fd77e" },
  { key: "baja",           label: "Baja",               color: "#8e8e93", fuerte: "#6c6c70", claro: "#b0b0b5" },
];

export const estadoDe = (k) => ESTADOS.find((e) => e.key === k) || ESTADOS[0];
