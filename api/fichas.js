import { autorizar } from "./_auth.js";
import { db } from "./_db.js";
import { fichaAFila } from "./_ficha.js";

/* Recibe una ficha del agente y la guarda en Neon.
   Idempotente: reenviar la misma ficha actualiza la fila, no crea otra. Es lo
   que permite que la cola offline reintente sin miedo a duplicar. */
export default async function handler(req, res) {
  const body = autorizar(req, res, "PIN_ACCESO");
  if (!body) return;

  const { ok, fila, error } = fichaAFila(body.ficha);
  if (!ok) {
    res.status(400).json({ error });
    return;
  }

  try {
    const sql = db();
    const [row] = await sql`
      insert into fichas (
        id, creada_en, agente_id, agente_nombre, operacion, tipo, referencia,
        direccion, numero, poblacion, provincia, cp, precio, datos, propietarios
      ) values (
        ${fila.id}, ${fila.creada_en}, ${fila.agente_id}, ${fila.agente_nombre},
        ${fila.operacion}, ${fila.tipo}, ${fila.referencia}, ${fila.direccion},
        ${fila.numero}, ${fila.poblacion}, ${fila.provincia}, ${fila.cp},
        ${fila.precio}, ${JSON.stringify(fila.datos)}, ${JSON.stringify(fila.propietarios)}
      )
      on conflict (id) do update set
        /* Un reenvío es una corrección del agente: se deja constancia para que
           la oficina pueda verlo. El estado y la nota de oficina NO se tocan:
           son suyos y su seguimiento no debe perderse. (Sin comillas
           invertidas en este comentario: cerrarían la plantilla de SQL.) */
        corregida_en = now(),
        envios = fichas.envios + 1,
        agente_id = excluded.agente_id,
        agente_nombre = excluded.agente_nombre,
        operacion = excluded.operacion,
        tipo = excluded.tipo,
        referencia = excluded.referencia,
        direccion = excluded.direccion,
        numero = excluded.numero,
        poblacion = excluded.poblacion,
        provincia = excluded.provincia,
        cp = excluded.cp,
        precio = excluded.precio,
        datos = excluded.datos,
        propietarios = excluded.propietarios
      returning id, recibida_en, corregida_en, envios
    `;
    res.status(200).json({
      ok: true,
      id: row.id,
      recibida: row.recibida_en,
      corregida: row.corregida_en,
      envios: row.envios,
    });
  } catch (err) {
    console.error("Error guardando la ficha", err);
    /* No se filtra el error interno al cliente, pero sí la categoría: una y
       otra se arreglan de forma distinta y el agente merece saber cuál es. */
    if (err?.esConfiguracion) {
      res.status(503).json({
        error: "El servidor no está bien configurado. Avisa a la oficina: la ficha no se perderá.",
        causa: "configuracion",
      });
      return;
    }
    res.status(503).json({
      error: "La base de datos no responde ahora mismo. Se reintentará solo.",
      causa: "basedatos",
    });
  }
}
