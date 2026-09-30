import { autorizarPanel } from "./_auth.js";
import { db } from "./_db.js";
import { filaAFicha, filaAResumen, fichaAFila, fichaAFilaDeOficina, ESTADOS } from "./_ficha.js";
import { notificarSinBloquear } from "./_push.js";
import { nombreDeFicha } from "../src/lib/resumen.js";
import { faseDe } from "../src/lib/fases.js";
import { prepararSubida, subirFicha } from "./_iagestion.js";

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
    if (accion === "crear") return await crear(sql, body, res, usuario);
    if (accion === "agentes") return agentes(res);
    if (accion === "eliminar") return await eliminar(sql, body, res, usuario);
    if (accion === "resumen") return await resumen(sql, res, usuario);
    if (accion === "iagestion_previa") return await iagestionPrevia(sql, body, res);
    if (accion === "iagestion_subir") return await iagestionSubir(sql, body, res, usuario);
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

/* Por qué se puede ordenar. El campo NO entra en el SQL: se compara con estas
   claves dentro de la consulta, que va parametrizada. Añadir una columna aquí
   es añadirla también al CASE de abajo. */
export const ORDENES = ["fecha", "referencia", "precio", "agente"];
export const SENTIDOS = ["desc", "asc"];

export function ordenPedido(body) {
  const campo = ORDENES.includes(body?.orden) ? body.orden : "fecha";
  const sentido = SENTIDOS.includes(body?.sentido) ? body.sentido : "desc";
  return { campo, sentido };
}

export async function listar(sql, body, res) {
  const limite = limitar(body.limite, 50, 200);
  const desde = limitar(body.desde, 1, 100000) - 1;
  const texto = typeof body.busqueda === "string" ? body.busqueda.trim().slice(0, 120) : "";
  const estado = ESTADOS.includes(body.estado) ? body.estado : null;
  const agente = typeof body.agenteId === "string" ? body.agenteId.slice(0, 100) : null;

  /* Un solo patrón para el LIKE; el driver parametriza, no se concatena SQL. */
  const patron = texto ? `%${texto}%` : null;

  const { campo, sentido } = ordenPedido(body);

  const filas = await sql`
    select id, recibida_en, corregida_en, envios, agente_id, agente_nombre,
           estado, origen, creada_en, creada_por, creada_por_nombre, operacion,
           tipo, referencia, direccion, numero, poblacion, precio, nota_oficina,
           importante, importante_por
    from fichas
    where eliminada_en is null
      and (${estado}::text is null or estado = ${estado})
      and (${agente}::text is null or agente_id = ${agente})
      and (${patron}::text is null or
           direccion ilike ${patron} or poblacion ilike ${patron} or
           referencia ilike ${patron} or agente_nombre ilike ${patron})
    /* El orden lo elige la oficina. El driver solo acepta plantillas, así que
       el campo no se concatena: se compara aquí dentro, ya parametrizado.

       Las claves numéricas van en un único término y el sentido se aplica
       multiplicando por -1, que evita repetir el CASE para asc y para desc.
       El nombre del agente es texto y no se puede negar, así que ese lleva
       sus dos términos.

       La referencia se ordena por su NÚMERO, no como texto: "#9" y "#10" en
       texto salen al revés. Las que no tienen referencia van siempre al final,
       en los dos sentidos: son las que están sin asignar.

       Por defecto, lo último que se ha movido: una corrección del agente
       interesa tanto como una captación nueva, y si no subiera al principio
       pasaría inadvertida.

       Y la columna id de último desempate SIEMPRE: sin ella, dos filas con la
       misma clave
       pueden salir en distinto orden en cada consulta, y con paginación eso
       hace que una ficha se repita en dos páginas o no salga en ninguna. */
    order by
      (case
         when ${campo} = 'referencia'
           /* [^0-9] y no \D a propósito: dentro de una plantilla de
              JavaScript, \D se convierte en la letra D y el SQL acababa
              quitando las des en vez de lo que no son cifras. */
           then nullif(regexp_replace(coalesce(referencia, ''), '[^0-9]', '', 'g'), '')::numeric
         when ${campo} = 'precio' then precio
         when ${campo} = 'fecha'
           then extract(epoch from coalesce(corregida_en, recibida_en))
       end) * (case when ${sentido} = 'asc' then 1 else -1 end) asc nulls last,
      (case when ${campo} = 'agente' and ${sentido} = 'asc' then agente_nombre end) asc nulls last,
      (case when ${campo} = 'agente' and ${sentido} = 'desc' then agente_nombre end) desc nulls last,
      id desc
    limit ${limite} offset ${desde}
  `;

  const [{ total }] = await sql`
    select count(*)::int as total from fichas
    where eliminada_en is null
      and (${estado}::text is null or estado = ${estado})
      and (${agente}::text is null or agente_id = ${agente})
      and (${patron}::text is null or
           direccion ilike ${patron} or poblacion ilike ${patron} or
           referencia ilike ${patron} or agente_nombre ilike ${patron})
  `;

  res.status(200).json({ fichas: filas.map(filaAResumen), total });
}

export async function detalle(sql, body, res) {
  if (!body.id) return res.status(400).json({ error: "Falta el identificador" });
  const [row] = await sql`select * from fichas where id = ${body.id} and eliminada_en is null`;
  if (!row) return res.status(404).json({ error: "Ficha no encontrada" });
  res.status(200).json({ ficha: filaAFicha(row) });
}

export async function actualizar(sql, body, res, usuario) {
  if (!body.id) return res.status(400).json({ error: "Falta el identificador" });
  if (body.estado !== undefined && !ESTADOS.includes(body.estado)) {
    return res.status(400).json({ error: "Estado no válido" });
  }
  const nota = body.nota === undefined ? null : String(body.nota).slice(0, 2000);

  /* Se lee antes para saber si la fase cambia de verdad y a qué agente avisar:
     después del UPDATE ya no se puede distinguir de un guardado sin cambios. */
  const [previa] = await sql`
    select estado, agente_id, referencia, direccion, numero
    from fichas where id = ${body.id} and eliminada_en is null
  `;
  if (!previa) return res.status(404).json({ error: "Ficha no encontrada" });

  /* La marca solo se toca si viene en la petición: guardar una nota no puede
     quitar el aviso sin querer. */
  const importante = typeof body.importante === "boolean" ? body.importante : null;

  const [row] = await sql`
    update fichas set
      estado = coalesce(${body.estado ?? null}, estado),
      nota_oficina = coalesce(${nota}, nota_oficina),
      importante = coalesce(${importante}::boolean, importante),
      importante_por = case
        when ${importante}::boolean is null then importante_por
        when ${importante}::boolean then ${usuario?.email || null}
        else null
      end,
      importante_en = case
        when ${importante}::boolean is null then importante_en
        when ${importante}::boolean then now()
        else null
      end,
      actualizada_por = ${usuario?.email || null}
    where id = ${body.id}
    returning id, estado, nota_oficina, importante, importante_por,
              actualizada_en, actualizada_por
  `;
  if (!row) return res.status(404).json({ error: "Ficha no encontrada" });

  /* El agente quiere saber cómo va lo suyo. Se avisa solo cuando la fase
     cambia de verdad: guardar una nota no es noticia para él. */
  if (body.estado && body.estado !== previa.estado) {
    const fase = faseDe(body.estado)?.label || "otra fase";
    const aviso = await notificarSinBloquear({
      tipo: "agente",
      destinatario: previa.agente_id,
      /* Un título que se entienda en la pantalla de bloqueo. Antes decía solo
         "Pendiente", que fuera de contexto no dice de qué va. */
      titulo: `Tu captación ${nombreDeFicha(previa)}`,
      cuerpo: `Ahora está en ${fase}.`,
      url: "/",
      /* Una etiqueta distinta por CAMBIO, no por ficha. Con `ficha-<id>` a
         secas, cada cambio de la misma captación sustituía al aviso anterior
         en el centro de notificaciones en vez de avisar, y el agente solo veía
         el primero. Agrupar tenía sentido para la oficina, que avisa una sola
         vez por ficha; aquí cada movimiento es una noticia, y perderse uno es
         mucho peor que ver dos. */
      etiqueta: `ficha-${row.id}-${new Date(row.actualizada_en).getTime()}`,
    });
    console.log(`Fase ${previa.estado} → ${body.estado}: ${aviso.enviadas} aviso(s) al agente`);
  }

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

  const [previa] = await sql`select * from fichas where id = ${body.id} and eliminada_en is null`;
  if (!previa) return res.status(404).json({ error: "Ficha no encontrada" });

  const anterior = filaAFicha(previa);
  const propietarios = Array.isArray(body.propietarios) ? body.propietarios : anterior.propietarios;

  const { ok, fila, error } = fichaAFila({
    ...anterior,
    creada: anterior.creada,
    data: body.data,
    propietarios,
  });
  if (!ok) {
    console.warn(`Edición rechazada (${usuario?.email}): ${error}`);
    return res.status(400).json({ error });
  }

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

/* La lista de agentes, para poder decir de quién era una captación que se
   teclea a mano. Solo id y nombre: el panel no necesita teléfonos ni correos,
   y lo que no se manda no se puede filtrar. */
export function agentes(res) {
  let lista = [];
  try {
    lista = JSON.parse(process.env.AGENTES_JSON || "[]");
    if (!Array.isArray(lista)) lista = [];
  } catch (err) {
    console.error("AGENTES_JSON no es JSON válido", err);
  }
  res.status(200).json({ agentes: lista.map((a) => ({ id: a.id, name: a.name })) });
}

/* Captación tecleada desde la oficina: las de antes de que existiera la app.

   No exige nada. De una captación de hace años puede no quedar el propietario
   ni el tipo, y forzar a rellenarlo llevaría a inventárselo.

   Dos cosas que la separan de una que llega del móvil:
   - No avisa a nadie. Julia la está escribiendo; no tiene sentido notificarle
     su propia captación.
   - `recibida_en` es la fecha que ella indique, no hoy. Si fueran todas de
     hoy, cuarenta captaciones antiguas aparecerían como "últimos 30 días" y
     el panel diría algo falso.

   Son dos cosas distintas y por eso van en dos columnas: `recibida_en` es
   CUÁNDO OCURRIÓ la captación —lo que ella escribe, puede ser de 2019— y
   `creada_en` es CUÁNDO SE TECLEÓ, que se sabe con exactitud porque es ahora.
   Mezclarlas era lo que hacía que todas salieran a una hora inventada.      */
export async function crear(sql, body, res, usuario) {
  const { ok, fila, error } = fichaAFilaDeOficina(body.ficha);
  if (!ok) {
    /* Se deja dicho POR QUÉ. Un 400 a secas en el log obliga a adivinar qué
       falló cuando alguien dice "no me deja guardar". */
    console.warn(`Captación rechazada (${usuario?.email}): ${error}`);
    return res.status(400).json({ error });
  }

  const estado = ESTADOS.includes(body.estado) ? body.estado : "nueva";
  const recibida = fechaSuelta(body.recibida) || new Date().toISOString();

  const [row] = await sql`
    insert into fichas (
      id, creada_en, recibida_en, agente_id, agente_nombre, operacion, tipo,
      referencia, direccion, numero, poblacion, provincia, cp, precio,
      datos, propietarios, estado, origen, envios, actualizada_por,
      creada_por, creada_por_nombre
    ) values (
      ${fila.id}, now(), ${recibida}, ${fila.agente_id}, ${fila.agente_nombre},
      ${fila.operacion}, ${fila.tipo}, ${fila.referencia}, ${fila.direccion},
      ${fila.numero}, ${fila.poblacion}, ${fila.provincia}, ${fila.cp}, ${fila.precio},
      ${JSON.stringify(fila.datos)}, ${JSON.stringify(fila.propietarios)},
      ${estado}, 'oficina', 0, ${usuario?.email || null},
      ${usuario?.email || null}, ${usuario?.nombre || null}
    )
    returning *
  `;

  console.log(`Captación creada a mano por ${usuario?.email}: ${fila.referencia || fila.direccion || "sin datos"}`);
  res.status(200).json({ ok: true, ficha: filaAFicha(row) });
}

/* El día de España, para saber si la fecha que escribe la oficina es hoy. */
const hoyEnEspana = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());

/* Cuándo entró la captación, a partir de lo que escribe la oficina.

   Si pone HOY, se guarda el instante real: es cuando ha entrado, se sabe al
   segundo, y así ordena donde le toca. Guardarla al mediodía hacía que una
   captación tecleada a las 10:00 quedara marcada a las 14:00 y se colara por
   ENCIMA de las que llegaban de verdad esa mañana: el muro enterraba las
   nuevas bajo las de la oficina.

   Si pone una fecha pasada, de aquel día no se sabe la hora. Se deja al
   mediodía, que mantiene el día estable en cualquier huso y —por ser un día
   que ya terminó— no puede adelantar a nada.

   Devuelve null si no se puede leer, para que quien llame decida qué poner. */
export function fechaSuelta(v) {
  if (typeof v !== "string" || !v.trim()) return null;
  if (v.length === 10) {
    if (v === hoyEnEspana()) return new Date().toISOString();
    const t = Date.parse(`${v}T12:00:00Z`);
    return Number.isFinite(t) ? new Date(t).toISOString() : null;
  }
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/* Borrado reversible. La ficha desaparece del panel y, en cuanto el móvil del
   agente sincronice, también de su historial. La fila se queda con la marca:
   si la oficina se equivoca, deshacerlo es un UPDATE y no una pérdida. */
export async function eliminar(sql, body, res, usuario) {
  if (!body.id) return res.status(400).json({ error: "Falta el identificador" });

  const [row] = await sql`
    update fichas
       set eliminada_en = now(), eliminada_por = ${usuario?.email || null}
     where id = ${body.id} and eliminada_en is null
    returning id, direccion, numero
  `;
  if (!row) return res.status(404).json({ error: "Ficha no encontrada o ya eliminada" });

  console.warn(`Ficha eliminada por ${usuario?.email}: ${(row.direccion + " " + (row.numero || "")).trim()}`);
  res.status(200).json({ ok: true, id: row.id });
}

export async function resumen(sql, res, usuario) {
  const porEstado = await sql`
    select estado, count(*)::int as n from fichas where eliminada_en is null group by estado
  `;
  const porAgente = await sql`
    select agente_id, agente_nombre, count(*)::int as n
    from fichas where eliminada_en is null
    group by agente_id, agente_nombre order by n desc limit 20
  `;
  /* El precio medio se calcula SOLO sobre ventas: promediar un chalet de
     545.000 € con un alquiler de 1.850 €/mes da un número sin sentido. */
  const [totales] = await sql`
    select count(*)::int as total,
           count(*) filter (where recibida_en > now() - interval '30 days')::int as ultimos30,
           count(*) filter (where operacion = 'Venta')::int as ventas,
           avg(precio) filter (where operacion = 'Venta')::numeric(12,2) as precio_medio_venta
    from fichas where eliminada_en is null
  `;
  res.status(200).json({ porEstado, porAgente, totales, usuario });
}

/* ---------------------------------------------------------------------------
   IA Gestión. Dos pasos a propósito: primero se ve qué se enviaría (no escribe
   nada) y luego se confirma. Lo que se sube va a inmuebles reales del CRM.
   ------------------------------------------------------------------------ */

async function fichaParaIagestion(sql, id, res) {
  if (!id) {
    res.status(400).json({ error: "Falta el identificador" });
    return null;
  }
  const [row] = await sql`select * from fichas where id = ${id} and eliminada_en is null`;
  if (!row) {
    res.status(404).json({ error: "Ficha no encontrada" });
    return null;
  }
  return filaAFicha(row);
}

export async function iagestionPrevia(sql, body, res) {
  const ficha = await fichaParaIagestion(sql, body.id, res);
  if (!ficha) return;
  const r = await prepararSubida(ficha);
  if (!r.ok) return res.status(200).json({ ok: false, error: r.error, noExiste: Boolean(r.noExiste) });
  res.status(200).json({
    ok: true,
    ref: r.ref,
    inmueble: r.inmueble,
    /* Las observaciones (HTML) se muestran como líneas; aquí solo lo demás. */
    parametros: Object.fromEntries(Object.entries(r.parametros).filter(([k]) => k !== "Observaciones_Privadas")),
    lineas: r.lineas,
    avisos: r.avisos,
  });
}

export async function iagestionSubir(sql, body, res, usuario) {
  if (body.confirmar !== true) return res.status(400).json({ error: "Falta la confirmación" });
  const ficha = await fichaParaIagestion(sql, body.id, res);
  if (!ficha) return;

  const r = await subirFicha(ficha);
  const resultado = {
    ok: r.ok === true,
    ref: r.ref || null,
    inmueble: r.inmueble || null,
    aplicados: (r.aplicados || []).map((a) => a.campo),
    noGuardados: r.noGuardados || [],
    avisos: r.avisos || [],
    error: r.error || null,
  };
  const estado = resultado.ok ? "subida" : "error";

  const [row] = await sql`
    update fichas set
      iagestion_estado = ${estado},
      iagestion_en = now(),
      iagestion_por = ${usuario?.email || null},
      iagestion_resultado = ${JSON.stringify(resultado)}::jsonb
    where id = ${body.id}
    returning iagestion_estado, iagestion_en, iagestion_por, iagestion_resultado
  `;
  res.status(200).json({
    ok: resultado.ok,
    resultado,
    iagestion: { estado: row.iagestion_estado, en: row.iagestion_en, por: row.iagestion_por, resultado: row.iagestion_resultado },
  });
}
