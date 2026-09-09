import { autorizar } from "./_auth.js";
import { db } from "./_db.js";


/* Las captaciones de un agente, completas, para reconstruir su historial.

   El historial de la app vive en el navegador del móvil, y eso se ha
   demostrado poco fiable: cambiar de teléfono, entrar por Safari en vez de por
   el icono de la pantalla de inicio, o que el navegador limpie el
   almacenamiento, dejan al agente sin ver captaciones que la oficina sí tiene.
   Con esto la lista se recupera en cualquier dispositivo.

   Devuelve la ficha ÍNTEGRA —datos y propietarios— porque el agente tiene que
   poder abrir una captación antigua, corregir un dato y reenviarla. Eso tiene
   una consecuencia que conviene tener presente: el PIN es común a todo el
   equipo, así que quien lo tenga puede pedir las captaciones de cualquier
   agente, con los nombres y teléfonos de sus propietarios. Si eso llega a
   importar, la solución es un PIN por agente, no tocar esto.

   Mitigaciones: solo las de ese agente, solo las no eliminadas, un tope de
   filas, y queda registrado en el log quién pide qué.

   Lo que NO se manda: la nota interna de la oficina y quién ha tocado la ficha
   desde el panel. La nota se llama interna porque lo es; el agente necesita
   sus datos y en qué fase va, no las anotaciones de seguimiento de Julia.   */

const MAX_FICHAS = 100;

export default async function handler(req, res) {
  const body = autorizar(req, res, "PIN_ACCESO");
  if (!body) return;

  const agenteId = typeof body.agenteId === "string" ? body.agenteId.trim().slice(0, 100) : "";
  if (!agenteId) {
    res.status(400).json({ error: "Falta el agente" });
    return;
  }

  try {
    const sql = db();
    const filas = await sql`
      select * from fichas
      where agente_id = ${agenteId} and eliminada_en is null
      order by recibida_en desc
      limit ${MAX_FICHAS}
    `;

    /* Se registra el acceso, no el contenido: con un PIN compartido, saber que
       alguien se ha descargado las captaciones de un agente es lo único que
       permite darse cuenta. */
    console.log(`Historial recuperado: ${agenteId} · ${filas.length} fichas`);

    /* Del más antiguo al más reciente: es el orden en que el móvil guarda su
       historial, y así se puede añadir al final sin reordenar. */
    res.status(200).json({ fichas: filas.reverse().map(paraElAgente) });
  } catch (err) {
    console.error("Error recuperando el historial", err);
    if (err?.esConfiguracion) {
      res.status(503).json({ error: "El servidor no está bien configurado" });
      return;
    }
    res.status(503).json({ error: "No se pudo recuperar el historial" });
  }
}

/* La ficha tal como la guarda el móvil en su historial. No es filaAFicha():
   esa incluye la nota interna y el rastro de quién ha editado desde el panel,
   que son cosas de la oficina. */
const paraElAgente = (row) => ({
  id: row.id,
  agenteId: row.agente_id,
  agenteName: row.agente_nombre,
  creada: row.creada_en,
  /* El historial ordena y muestra por `fecha`. Se usa la de entrada en la
     oficina, que es la que ve el agente en su lista. */
  fecha: row.recibida_en,
  data: row.datos || {},
  propietarios: row.propietarios || [],
  fase: row.estado,
  envio: { estado: "enviada", envios: row.envios ?? 1 },
});
