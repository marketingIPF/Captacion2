import { autorizarPanel } from "./_auth.js";
import { db } from "./_db.js";
import { filaAFicha, filaAResumen, fichaAFila, ESTADOS } from "./_ficha.js";

/* Panel de oficina. El acceso va por sesión de Neon Auth (Google), no por PIN:
   cada persona entra con su cuenta y se le puede revocar el acceso por
   separado. El token viaja en la cabecera Authorization, nunca en la URL. */
export default async function handler(req, res) {
  const sesion = await autorizarPanel(req, res);
  if (!sesion) return;
  const { body, usuario } = sesion;

  const sql = db();
  const accion = body.accion || "listar";

  try {
    if (accion === "listar") return await listar(sql, body, res);
    if (accion === "detalle") return await detalle(sql, body, res);
    if (accion === "actualizar") return await actualizar(sql, body, res, usuario);
    if (accion === "editar") return await editar(sql, body, res, usuario);
    if (accion === "resumen") return await resumen(sql, res, usuario);
    res.status(400).json({ error: "Acción desconocida" });
  } catch (err) {
    console.error(`Error en la acción "${accion}"`, err);
    if (err?.esConfiguracion) {
      res.status(503).json({ error: "El panel no está bien configurado: falta DATABASE_URL en este entorno." });
      return;
    }
    res.status(500).json({ error: "Error consultando la base de datos" });
  }
}

const limitar = (n, def, max) => {
  const v = Number(n);
  return Number.isInteger(v) && v > 0 && v <= max ? v : def;
};

export async function listar(sql, body, res) {
  const limite = limitar(body.limite, 50, 200);
  const desde = limitar(body.desde, 1, 100000) - 1;
  const texto = typeof body.busqueda === "string" ? body.busqueda.trim().slice(0, 120) : "";
  const estado = ESTADOS.includes(body.estado) ? body.estado : null;
  const agente = typeof body.agenteId === "string" ? body.agenteId.slice(0, 100) : null;

  /* Un solo patrón para el LIKE; el driver parametriza, no se concatena SQL. */
  const patron = texto ? `%${texto}%` : null;

  const filas = await sql`
    select id, recibida_en, corregida_en, envios, agente_id, agente_nombre,
           estado, operacion, tipo, referencia, direccion, numero, poblacion, precio
    from fichas
    where (${estado}::text is null or estado = ${estado})
      and (${agente}::text is null or agente_id = ${agente})
      and (${patron}::text is null or
           direccion ilike ${patron} or poblacion ilike ${patron} or
           referencia ilike ${patron} or agente_nombre ilike ${patron})
    /* Por lo último que se ha movido: una corrección del agente interesa
       tanto como una captación nueva, y si no subiera al principio pasaría
       inadvertida. */
    order by coalesce(corregida_en, recibida_en) desc
    limit ${limite} offset ${desde}
  `;

  const [{ total }] = await sql`
    select count(*)::int as total from fichas
    where (${estado}::text is null or estado = ${estado})
      and (${agente}::text is null or agente_id = ${agente})
      and (${patron}::text is null or
           direccion ilike ${patron} or poblacion ilike ${patron} or
           referencia ilike ${patron} or agente_nombre ilike ${patron})
  `;

  res.status(200).json({ fichas: filas.map(filaAResumen), total });
}

export async function detalle(sql, body, res) {
  if (!body.id) return res.status(400).json({ error: "Falta el identificador" });
  const [row] = await sql`select * from fichas where id = ${body.id}`;
  if (!row) return res.status(404).json({ error: "Ficha no encontrada" });
  res.status(200).json({ ficha: filaAFicha(row) });
}

export async function actualizar(sql, body, res, usuario) {
  if (!body.id) return res.status(400).json({ error: "Falta el identificador" });
  if (body.estado !== undefined && !ESTADOS.includes(body.estado)) {
    return res.status(400).json({ error: "Estado no válido" });
  }
  const nota = body.nota === undefined ? null : String(body.nota).slice(0, 2000);

  const [row] = await sql`
    update fichas set
      estado = coalesce(${body.estado ?? null}, estado),
      nota_oficina = coalesce(${nota}, nota_oficina),
      actualizada_por = ${usuario?.email || null}
    where id = ${body.id}
    returning id, estado, nota_oficina, actualizada_en, actualizada_por
  `;
  if (!row) return res.status(404).json({ error: "Ficha no encontrada" });
  res.status(200).json({ ok: true, ficha: row });
}

/* Edición de la ficha desde la oficina.
   Reutiliza fichaAFila(), la misma traducción y validación que usa la entrada
   del agente, para que no haya dos definiciones de qué es una ficha válida.
   Escribe a la vez las columnas desnormalizadas y el jsonb: si quedaran
   desparejados, el listado diría una cosa y la ficha otra. */
export async function editar(sql, body, res, usuario) {
  if (!body.id) return res.status(400).json({ error: "Falta el identificador" });
  if (!body.data || typeof body.data !== "object") {
    return res.status(400).json({ error: "Faltan los datos de la ficha" });
  }

  const [previa] = await sql`select * from fichas where id = ${body.id}`;
  if (!previa) return res.status(404).json({ error: "Ficha no encontrada" });

  const anterior = filaAFicha(previa);
  const propietarios = Array.isArray(body.propietarios) ? body.propietarios : anterior.propietarios;

  const { ok, fila, error } = fichaAFila({
    ...anterior,
    creada: anterior.creada,
    data: body.data,
    propietarios,
  });
  if (!ok) return res.status(400).json({ error });

  const [row] = await sql`
    update fichas set
      operacion = ${fila.operacion},
      tipo = ${fila.tipo},
      referencia = ${fila.referencia},
      direccion = ${fila.direccion},
      numero = ${fila.numero},
      poblacion = ${fila.poblacion},
      provincia = ${fila.provincia},
      cp = ${fila.cp},
      precio = ${fila.precio},
      datos = ${JSON.stringify(fila.datos)},
      propietarios = ${JSON.stringify(fila.propietarios)},
      actualizada_por = ${usuario?.email || null}
    where id = ${body.id}
    returning *
  `;

  res.status(200).json({ ok: true, ficha: filaAFicha(row) });
}

export async function resumen(sql, res, usuario) {
  const porEstado = await sql`select estado, count(*)::int as n from fichas group by estado`;
  const porAgente = await sql`
    select agente_id, agente_nombre, count(*)::int as n
    from fichas group by agente_id, agente_nombre order by n desc limit 20
  `;
  /* El precio medio se calcula SOLO sobre ventas: promediar un chalet de
     545.000 € con un alquiler de 1.850 €/mes da un número sin sentido. */
  const [totales] = await sql`
    select count(*)::int as total,
           count(*) filter (where recibida_en > now() - interval '30 days')::int as ultimos30,
           count(*) filter (where operacion = 'Venta')::int as ventas,
           avg(precio) filter (where operacion = 'Venta')::numeric(12,2) as precio_medio_venta
    from fichas
  `;
  res.status(200).json({ porEstado, porAgente, totales, usuario });
}
