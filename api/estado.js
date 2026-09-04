import { autorizar } from "./_auth.js";
import { db } from "./_db.js";

/* Estado actual de las fichas que el agente tiene en su móvil.
   Resuelve dos cosas con una sola llamada: le dice en qué fase está cada una
   y cuáles ha borrado la oficina, para que su historial no muestre algo que
   ya no existe. Solo devuelve el estado, nunca datos de la ficha. */
const MAX_IDS = 200;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  const body = autorizar(req, res, "PIN_ACCESO");
  if (!body) return;

  const ids = Array.isArray(body.ids)
    ? [...new Set(body.ids.filter((v) => typeof v === "string" && UUID_RE.test(v)))].slice(0, MAX_IDS)
    : [];

  const agenteId = typeof body.agenteId === "string" ? body.agenteId.trim().slice(0, 100) : "";

  if (!ids.length) return res.status(200).json({ estados: {}, eliminadas: [] });

  try {
    const sql = db();
    const filas = await sql`
      select id, estado, agente_id, eliminada_en
      from fichas
      where id = any(${ids}::uuid[])
    `;

    res.status(200).json(repartir(ids, filas, agenteId));
  } catch (err) {
    console.error("Error consultando estados", err);
    if (err?.esConfiguracion) {
      res.status(503).json({ error: "El servidor no está bien configurado" });
      return;
    }
    res.status(503).json({ error: "No se pudieron consultar los estados" });
  }
}

/* Qué se le contesta al móvil sobre cada ficha que dice tener.

   De otro agente no se contesta nada: ni en qué fase va, ni que la hayan
   borrado. El PIN es común a toda la oficina, así que sin este filtro
   cualquier móvil podría seguir las captaciones de un compañero.

   Y una ficha ajena tampoco se marca como eliminada: el móvil se la quitaría
   del historial, que es justo lo contrario de lo que hace falta. */
export function repartir(ids, filas, agenteId) {
  const propia = (f) => !agenteId || f.agente_id === agenteId;

  const estados = Object.fromEntries(
    filas.filter((f) => !f.eliminada_en && propia(f)).map((f) => [f.id, f.estado])
  );

  /* Se quita del historial lo que el servidor ya no tiene: borrada en la
     oficina, o nunca llegó a guardarse. */
  const ajenas = new Set(filas.filter((f) => !propia(f)).map((f) => f.id));
  const eliminadas = ids.filter((id) => !(id in estados) && !ajenas.has(id));

  return { estados, eliminadas };
}
