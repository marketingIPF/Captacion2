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

  if (!ids.length) return res.status(200).json({ estados: {}, eliminadas: [] });

  try {
    const sql = db();
    const filas = await sql`
      select id, estado, corregida_en
      from fichas
      where id = any(${ids}::uuid[]) and eliminada_en is null
    `;

    const estados = Object.fromEntries(filas.map((f) => [f.id, f.estado]));
    /* Lo que el agente tiene y el servidor ya no: borrada en la oficina, o
       nunca llegó a guardarse. En ambos casos su historial debe reflejarlo. */
    const eliminadas = ids.filter((id) => !(id in estados));

    res.status(200).json({ estados, eliminadas });
  } catch (err) {
    console.error("Error consultando estados", err);
    if (err?.esConfiguracion) {
      res.status(503).json({ error: "El servidor no está bien configurado" });
      return;
    }
    res.status(503).json({ error: "No se pudieron consultar los estados" });
  }
}
