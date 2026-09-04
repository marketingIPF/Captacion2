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

/* Las fases y sus colores viven en lib/fases.js: aquí solo se reexportan con
   el nombre que usa el panel. */
export { FASES as ESTADOS, faseOPrimera as estadoDe } from "../lib/fases.js";
