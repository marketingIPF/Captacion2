/* Estado de las fichas que el agente ya ha enviado.
   La oficina las va moviendo de fase (y a veces las borra); el móvil pregunta
   para que su historial diga la verdad y no un "recibida" congelado del día
   que la mandó. */

export async function consultarEstados(pin, ids) {
  if (!pin || !ids?.length) return { ok: true, estados: {}, eliminadas: [] };
  try {
    const r = await fetch("/api/estado", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, ids }),
    });
    if (!r.ok) return { ok: false };
    const { estados, eliminadas } = await r.json();
    return { ok: true, estados: estados || {}, eliminadas: eliminadas || [] };
  } catch {
    /* Sin conexión no pasa nada: se sigue mostrando lo último que se supo. */
    return { ok: false };
  }
}

/* Las fases se reexportan desde su única definición. */
export { faseDe } from "./fases.js";
