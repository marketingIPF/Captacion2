/* Recuperar el historial del agente desde la oficina.

   El historial vive en el navegador del móvil, y eso resultó poco fiable:
   cambiar de teléfono, entrar por Safari en vez de por el icono de la pantalla
   de inicio, o que el navegador limpie el almacenamiento, dejaban al agente
   sin ver captaciones que la oficina sí tenía. */

export async function pedirMisFichas(pin, agenteId) {
  if (!pin || !agenteId) return { ok: false };
  try {
    const r = await fetch("/api/mis-fichas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, agenteId }),
    });
    if (!r.ok) return { ok: false };
    const { fichas } = await r.json();
    return { ok: true, fichas: Array.isArray(fichas) ? fichas : [] };
  } catch {
    /* Sin conexión no pasa nada: se sigue viendo lo que haya en el móvil. */
    return { ok: false };
  }
}

/* Une lo que dice la oficina con lo que tiene el móvil.

   Las dos reglas que importan:

   1. Una ficha que el móvil tiene PENDIENTE de enviar no se toca. Puede ser
      una corrección que el agente hizo sin cobertura: si dejáramos ganar a la
      oficina, se perdería su trabajo justo antes de que la cola lo mande.

   2. Del resto manda la oficina. Si tiene la ficha, es que llegó — así que un
      "sin enviar" del móvil que la oficina sí conoce pasa a enviada, y la fase
      y los datos se ponen al día.

   Lo que el móvil tiene y la oficina no se queda igual: son fichas en cola, o
   rechazadas, que todavía no han llegado.                                    */
export function unirHistorial(locales, deLaOficina) {
  const unidas = new Map((locales || []).map((f) => [f.id, f]));

  for (const remota of deLaOficina || []) {
    const local = unidas.get(remota.id);
    if (local?.envio?.estado === "pendiente") continue;
    unidas.set(remota.id, local ? { ...local, ...remota } : remota);
  }

  /* Del más antiguo al más reciente, que es como el historial espera la lista:
     la pantalla la recorre al revés para mostrar lo último arriba. */
  return [...unidas.values()].sort((a, b) => String(a.fecha || "").localeCompare(String(b.fecha || "")));
}
