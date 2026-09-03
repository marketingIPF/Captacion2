/* Consulta a los servicios públicos del Catastro (Sede Electrónica).
   Sirve por HTTPS y con CORS abierto, así que se llama desde el navegador sin
   necesidad de proxy. Solo devuelve datos NO protegidos: dirección, superficie,
   año y uso. Nunca datos del titular. */

const BASE =
  "https://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero/COVCCallejero.svc/json/Consulta_DNPRC";

/* Códigos de tipo de vía del Catastro. Los que no estén se dejan tal cual. */
const TIPOS_VIA = {
  CL: "Calle", AV: "Avenida", PZ: "Plaza", PS: "Paseo", CM: "Camino",
  CR: "Carretera", TR: "Travesía", RD: "Ronda", GL: "Glorieta", PJ: "Pasaje",
  CJ: "Callejón", RB: "Rambla", GV: "Gran Vía", AL: "Alameda", BO: "Barrio",
  UR: "Urbanización", PD: "Partida", DS: "Diseminado", SD: "Senda",
  VI: "Vía", PQ: "Parque", PL: "Polígono", BL: "Bloque", GR: "Grupo",
};

/* Uso catastral → tipo de inmueble de la ficha. "Residencial" se queda fuera a
   propósito: el Catastro no distingue piso de ático ni de chalet, y el tipo
   decide qué campos se piden, así que lo elige el agente. */
const USO_A_TIPO = {
  Comercial: "Local",
  Industrial: "Local",
  Oficinas: "Local",
  "Almacen-Estacionamiento": "Garaje",
  "Suelo sin edif.": "Terreno",
};

export const limpiarRef = (v) => String(v || "").replace(/[\s-]/g, "").toUpperCase();

/* 14 caracteres = la parcela entera (puede tener muchas unidades).
   20 = una unidad concreta. Cualquier otra longitud no es válida. */
export function tipoDeRef(v) {
  const r = limpiarRef(v);
  if (!/^[A-Z0-9]+$/.test(r)) return null;
  if (r.length === 14) return "parcela";
  if (r.length === 20) return "unidad";
  return null;
}

const texto = (v) => (v === undefined || v === null ? "" : String(v).trim());

/* El Catastro devuelve todo en mayúsculas y sin acentos. Se pasa a
   capitalización normal para que no chille en el formulario; los acentos no se
   pueden recuperar, así que el agente los repone si quiere. */
const PARTICULAS = new Set(["de", "del", "la", "las", "el", "los", "y", "en", "a", "al"]);

export function capitalizar(v) {
  const s = texto(v).toLowerCase();
  if (!s) return "";
  return s
    .split(/(\s+)/)
    .map((trozo, i) => {
      if (/^\s+$/.test(trozo)) return trozo;
      if (i > 0 && PARTICULAS.has(trozo)) return trozo;
      /* Respeta guiones internos: "sant-joan" → "Sant-Joan" */
      return trozo
        .split("-")
        .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
        .join("-");
    })
    .join("");
}

/* El Catastro trae un segundo número (snp) que suele venir a cero. Solo se
   concatena cuando es un número real, para casos legítimos como "26-28". */
const esNumeroReal = (v) => {
  const t = texto(v);
  return t !== "" && Number(t) > 0;
};

const numeroDeVia = (dir) => {
  const primero = texto(dir?.pnp);
  const segundo = texto(dir?.snp);
  if (esNumeroReal(segundo) && segundo !== primero) return `${primero}-${segundo}`;
  return primero;
};

const calle = (dir) => {
  const tipo = TIPOS_VIA[texto(dir?.tv)] || capitalizar(dir?.tv);
  return [tipo, capitalizar(dir?.nv)].filter(Boolean).join(" ");
};

/* Un registro del Catastro → los campos de nuestra ficha. */
function normalizar(nodo) {
  const dt = nodo?.dt || {};
  const urb = dt?.locs?.lous?.lourb || {};
  const dir = urb.dir || {};
  const interior = urb.loint || {};
  const debi = nodo?.debi || {};
  const rc = nodo?.rc || nodo?.idbi?.rc || {};

  return {
    ref: [rc.pc1, rc.pc2, rc.car, rc.cc1, rc.cc2].filter(Boolean).join(""),
    direccion: calle(dir),
    numero: numeroDeVia(dir),
    escalera: texto(interior.es),
    planta: texto(interior.pt),
    puerta: texto(interior.pu),
    cp: texto(urb.dp),
    poblacion: capitalizar(dt.nm),
    provincia: capitalizar(dt.np),
    mConstruidos: texto(debi.sfc),
    anio: texto(debi.ant),
    uso: texto(debi.luso),
    tipoSugerido: USO_A_TIPO[texto(debi.luso)] || null,
  };
}

/* Etiqueta para la lista de unidades de una parcela. */
export function etiquetaUnidad(u) {
  const sitio = [
    u.escalera && `Esc. ${u.escalera}`,
    u.planta && `Planta ${u.planta}`,
    u.puerta && `Puerta ${u.puerta}`,
  ].filter(Boolean).join(" · ");
  const datos = [u.uso, u.mConstruidos && `${u.mConstruidos} m²`].filter(Boolean).join(" · ");
  return { sitio: sitio || "Sin desglose", datos };
}

/* Convierte la respuesta cruda del Catastro en { ok, unidades } | { ok:false, error }.
   Separado del fetch para poder probarlo con respuestas grabadas. */
export function interpretar(json) {
  const r = json?.consulta_dnprcResult;
  if (!r) return { ok: false, error: "El Catastro devolvió una respuesta inesperada" };

  if (r.control?.cuerr) {
    const err = Array.isArray(r.lerr) ? r.lerr[0] : r.lerr;
    const des = texto(err?.des) || "El Catastro rechazó la consulta";
    /* Los mensajes del Catastro vienen en mayúsculas; se dejan legibles. */
    const bonito = des.charAt(0) + des.slice(1).toLowerCase();
    return { ok: false, error: bonito, codigo: texto(err?.cod) };
  }

  /* Una sola unidad. */
  if (r.bico?.bi) return { ok: true, unidades: [normalizar(r.bico.bi)] };

  /* Varias: el servicio devuelve objeto suelto cuando hay una sola. */
  const lista = r.lrcdnp?.rcdnp;
  if (lista) {
    const arr = Array.isArray(lista) ? lista : [lista];
    const unidades = arr.map(normalizar).filter((u) => u.ref);
    if (unidades.length) return { ok: true, unidades };
  }

  return { ok: false, error: "Esa referencia no devolvió ningún inmueble" };
}

export async function consultarCatastro(refBruta, { signal } = {}) {
  const ref = limpiarRef(refBruta);
  if (!tipoDeRef(ref)) {
    return { ok: false, error: "La referencia catastral tiene 14 o 20 caracteres" };
  }
  try {
    const res = await fetch(`${BASE}?RefCat=${encodeURIComponent(ref)}`, {
      signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return { ok: false, error: `El Catastro respondió ${res.status}` };
    return interpretar(await res.json());
  } catch (err) {
    if (err?.name === "AbortError") return { ok: false, cancelado: true };
    return { ok: false, error: "No se pudo contactar con el Catastro" };
  }
}

/* Campos de la ficha que rellena una unidad. El tipo de inmueble se sugiere
   solo si está vacío: cambiarlo reharía todo el formulario. */
export function camposDesde(unidad) {
  const campos = {
    refCatastral: unidad.ref,
    direccion: unidad.direccion,
    numero: unidad.numero,
    bloque: unidad.escalera,
    planta: unidad.planta,
    puerta: unidad.puerta,
    cp: unidad.cp,
    poblacion: unidad.poblacion,
    provincia: unidad.provincia,
    mConstruidos: unidad.mConstruidos,
    anio: unidad.anio,
  };
  /* Se descartan los vacíos: no tiene sentido borrar lo que ya había. */
  return Object.fromEntries(Object.entries(campos).filter(([, v]) => v !== ""));
}
