/* Traducción entre la ficha del navegador y la fila de Postgres.
   Aislado aquí para poder probarlo sin base de datos. */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* Los números llegan como texto en formato español ("250.000" o "85,5"). */
export function aNumero(v) {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

const texto = (v, max = 300) =>
  v === undefined || v === null || v === "" ? null : String(v).slice(0, max);

/* Las fases viven en src/lib/fases.js, que es la única definición: el
   servidor valida contra la misma lista que pintan el panel y la app. */
export { CLAVES_FASE as ESTADOS } from "../src/lib/fases.js";

/* Valida y normaliza lo que manda el cliente. Devuelve { ok, fila } o { ok:false, error }. */
export function fichaAFila(ficha) {
  if (!ficha || typeof ficha !== "object") return { ok: false, error: "Ficha vacía" };
  if (!UUID_RE.test(String(ficha.id || ""))) return { ok: false, error: "Identificador de ficha no válido" };

  const d = ficha.data;
  if (!d || typeof d !== "object") return { ok: false, error: "La ficha no tiene datos" };
  if (!ficha.agenteId || !ficha.agenteName) return { ok: false, error: "Falta el agente captador" };
  if (!d.tipo) return { ok: false, error: "Falta el tipo de inmueble" };
  if (!d.direccion) return { ok: false, error: "Falta la dirección" };

  const propietarios = Array.isArray(ficha.propietarios) ? ficha.propietarios : [];
  if (!propietarios.some((p) => p?.nombre?.trim())) {
    return { ok: false, error: "Falta el nombre de un propietario" };
  }

  /* Tope de tamaño: una ficha legítima no pasa de unos pocos KB. */
  const peso = JSON.stringify({ d, propietarios }).length;
  if (peso > 200_000) return { ok: false, error: "La ficha es demasiado grande" };

  return { ok: true, fila: aFila(ficha, d, propietarios) };
}

/* La misma traducción, sin exigencias.

   Es para las captaciones que la oficina teclea a mano: las de antes de que
   existiera la app. De esas puede no quedar el propietario, ni el tipo, ni la
   dirección completa, y obligar a rellenarlas llevaría a inventarse datos, que
   es peor que no tenerlos. Lo único que se exige es un identificador válido.

   Se mantiene aparte de fichaAFila y no como una bandera dentro porque las
   exigencias de la entrada del agente son deliberadas: ahí SÍ tiene que haber
   propietario y dirección, y no quiero que una bandera mal puesta las
   desactive sin que se note. */
export function fichaAFilaDeOficina(ficha) {
  if (!ficha || typeof ficha !== "object") return { ok: false, error: "Ficha vacía" };
  if (!UUID_RE.test(String(ficha.id || ""))) return { ok: false, error: "Identificador de ficha no válido" };

  const d = ficha.data && typeof ficha.data === "object" ? ficha.data : {};
  const propietarios = Array.isArray(ficha.propietarios)
    ? ficha.propietarios.filter((p) => p && Object.values(p).some((v) => String(v ?? "").trim()))
    : [];

  const peso = JSON.stringify({ d, propietarios }).length;
  if (peso > 200_000) return { ok: false, error: "La ficha es demasiado grande" };

  /* agente_id y agente_nombre no admiten nulo en la base de datos, y tampoco
     tendría sentido: toda captación es de alguien. Si la oficina no sabe de
     quién era, queda a su nombre, que es la verdad. */
  const conAgente = {
    ...ficha,
    agenteId: ficha.agenteId || AGENTE_OFICINA.id,
    agenteName: ficha.agenteName || AGENTE_OFICINA.name,
  };

  return { ok: true, fila: aFila(conAgente, d, propietarios) };
}

export const AGENTE_OFICINA = { id: "oficina", name: "Oficina" };

function aFila(ficha, d, propietarios) {
  return {
    id: ficha.id,
    creada_en: fechaValida(ficha.creada) || new Date().toISOString(),
    agente_id: texto(ficha.agenteId, 100),
    agente_nombre: texto(ficha.agenteName, 200),
    operacion: texto(d.operacion, 20),
    tipo: texto(d.tipo, 40),
    referencia: texto(d.referencia, 80),
    direccion: texto(d.direccion),
    numero: texto(d.numero, 20),
    poblacion: texto(d.poblacion, 120),
    provincia: texto(d.provincia, 120),
    cp: texto(d.cp, 10),
    precio: aNumero(d.precio),
    datos: d,
    propietarios,
  };
}

function fechaValida(iso) {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/* Fila de Postgres → objeto que consume el panel. */
export const filaAFicha = (row) => ({
  id: row.id,
  creada: row.creada_en,
  recibida: row.recibida_en,
  actualizada: row.actualizada_en,
  corregida: row.corregida_en || null,
  envios: row.envios ?? 1,
  /* Para que el listado pueda distinguir a simple vista qué inmuebles ya
     tienen anotación, sin traerse el texto entero de cada uno. */
  tieneNota: Boolean(row.nota_oficina && String(row.nota_oficina).trim()),
  agenteId: row.agente_id,
  agenteName: row.agente_nombre,
  estado: row.estado,
  /* 'oficina' = la teclearon en el panel, no llegó de un móvil. Justifica
     que le falten datos, y quién lo hizo se dice con nombre y apellidos: en
     el panel entra más de una persona. */
  origen: row.origen || "agente",
  creadaPor: row.creada_por || null,
  creadaPorNombre: row.creada_por_nombre || null,
  notaOficina: row.nota_oficina,
  actualizadaPor: row.actualizada_por || null,
  data: row.datos,
  propietarios: row.propietarios || [],
});

/* Fila reducida para el listado: sin datos personales del propietario. */
export const filaAResumen = (row) => ({
  id: row.id,
  recibida: row.recibida_en,
  corregida: row.corregida_en || null,
  envios: row.envios ?? 1,
  /* El id permite pintar el avatar; no revela nada que no muestre ya el
     nombre, que va justo al lado. */
  agenteId: row.agente_id,
  agenteName: row.agente_nombre,
  estado: row.estado,
  /* 'oficina' = la teclearon en el panel, no llegó de un móvil. Justifica
     que le falten datos, y quién lo hizo se dice con nombre y apellidos: en
     el panel entra más de una persona. */
  origen: row.origen || "agente",
  creadaPor: row.creada_por || null,
  creadaPorNombre: row.creada_por_nombre || null,
  operacion: row.operacion,
  tipo: row.tipo,
  referencia: row.referencia,
  direccion: [row.direccion, row.numero].filter(Boolean).join(" "),
  poblacion: row.poblacion,
  precio: row.precio === null ? null : Number(row.precio),
});
