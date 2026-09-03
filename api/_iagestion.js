/* Traducción de nuestra ficha al formato del CRM iagestión.
   Aislado y sin efectos secundarios para poder probarlo y, sobre todo, para
   poder VER lo que se enviaría antes de escribir nada en el CRM.

   Manual: POST https://pasarelas.iagestion.com/api-gestioninmo/v2/<servicio>/
   Autenticación: `usuario` y `password` como parámetros del propio POST.   */

import { parseNumero } from "../src/lib/validacion.js";

export const BASE = "https://pasarelas.iagestion.com/api-gestioninmo/v2";

/* La API es PHP y espera los parámetros como formulario, no como JSON: el
   ejemplo del manual usa CURLOPT_POSTFIELDS con un array. Enviando JSON
   responde "Autenticación con usuario y password es obligatoria", como si
   faltaran las credenciales. */
export async function llamarIagestion(servicio, parametros = {}) {
  const usuario = process.env.IAGESTION_USUARIO;
  const password = process.env.IAGESTION_PASSWORD;
  if (!usuario || !password) {
    return { ok: false, error: "Faltan IAGESTION_USUARIO / IAGESTION_PASSWORD" };
  }

  const cuerpo = new URLSearchParams({ usuario, password });
  for (const [k, v] of Object.entries(parametros)) {
    if (v === undefined || v === null || v === "") continue;
    cuerpo.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
  }

  let respuesta;
  try {
    respuesta = await fetch(`${BASE}/${servicio}/`, { method: "POST", body: cuerpo });
  } catch {
    return { ok: false, error: "No se pudo contactar con el CRM" };
  }

  const texto = await respuesta.text();

  /* El CRM devuelve 200 incluso cuando falla, y a veces con un error de PHP
     en crudo en vez de JSON. Hay que mirar el contenido, no el código. */
  let datos = null;
  try {
    datos = JSON.parse(texto);
  } catch {
    const fatal = /Fatal error|PDOException|SQLSTATE/i.test(texto);
    return {
      ok: false,
      estado: respuesta.status,
      error: fatal
        ? "El CRM rechazó las credenciales (error interno de su base de datos)"
        : `El CRM no devolvió JSON (${respuesta.status})`,
      crudo: texto.slice(0, 400),
    };
  }

  if (datos?.error) {
    return { ok: false, estado: respuesta.status, error: String(datos.message || "Error del CRM"), datos };
  }
  return { ok: true, estado: respuesta.status, datos };
}

/* Nuestros tipos → los del CRM.
   OJO: los valores del CRM hay que confirmarlos con el servicio tipo_inmueble;
   estos son la conjetura razonable. `npm run iagestion:tipos` los descarga. */
export const TIPOS = {
  "Piso": "Piso",
  "Ático": "Ático",
  "Casa / Chalet": "Casa/Chalet",
  "Local": "Local",
  "Terreno": "Terreno",
  "Garaje": "Garaje",
};

const entero = (v) => {
  const n = parseNumero(v);
  return n === null ? undefined : Math.round(n);
};

const numero = (v) => {
  const n = parseNumero(v);
  return n === null ? undefined : n;
};

/* Sus campos de superficie y precio son numéricos; los nuestros son texto en
   formato español ("298,5", "385.000"). */
const siNo = (v) => (v === "Sí" ? 1 : v === "No" ? 0 : undefined);

const tieneEn = (lista, valor) => (Array.isArray(lista) ? (lista.includes(valor) ? 1 : 0) : undefined);

/* "Carmen Ferrer Ros" → { Nombre: "Carmen", Apellidos: "Ferrer Ros" } */
export function partirNombre(completo) {
  const partes = String(completo || "").trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return { Nombre: "", Apellidos: "" };
  return { Nombre: partes[0], Apellidos: partes.slice(1).join(" ") };
}

/* Referencia única y estable: es la que evita duplicados (el CRM responde 409
   si ya existe), así que reenviar la misma ficha no crea otra. */
export function refIntranet(ficha) {
  const propia = String(ficha.data?.referencia || "").trim();
  if (propia) return propia;
  return `RK-${String(ficha.id).replace(/-/g, "").slice(0, 10).toUpperCase()}`;
}

/* Lo que el CRM no tiene como campo propio y se perdería: se añade al final de
   las observaciones privadas para no dejarlo fuera. */
function observacionesPrivadas(ficha) {
  const d = ficha.data;
  const extra = [
    d.refCatastral && `Ref. catastral: ${d.refCatastral}`,
    d.cee && `Certificado energético: ${d.cee}${d.ceeLetra ? ` (${d.ceeLetra})` : ""}`,
    d.cargas && d.cargas !== "No" && `Cargas: ${d.cargas}${d.cargasDetalle ? ` — ${d.cargasDetalle}` : ""}`,
    d.autorizacion && `Autorización firmada: ${d.autorizacion}${d.exclusiva ? ` (${d.exclusiva})` : ""}`,
    d.precioMin && `Precio mínimo aceptable: ${d.precioMin} €`,
    d.comunidad && `Comunidad: ${d.comunidad} €/mes`,
    d.ibi && `IBI: ${d.ibi} €/año`,
    d.honorarios && `Honorarios: ${d.honorarios}${d.honorariosValor ? ` ${d.honorariosValor}` : ""}`,
    Array.isArray(d.docs) && d.docs.length && `Documentación aportada: ${d.docs.join(", ")}`,
    d.ocupacion && `Situación: ${d.ocupacion}`,
    `Captada por ${ficha.agenteName} el ${new Date(ficha.creada || ficha.recibida).toLocaleDateString("es-ES")}`,
  ].filter(Boolean);

  return [d.notasInternas, extra.join("\n")].filter(Boolean).join("\n\n");
}

/* Ficha → cuerpo del POST a grabar_inmueble.
   Devuelve { ok, datos, avisos } — los avisos son cosas que el CRM aceptará
   pero que conviene revisar (un tipo sin equivalencia, por ejemplo). */
export function fichaAInmueble(ficha) {
  const d = ficha.data || {};
  const avisos = [];

  const tipo = TIPOS[d.tipo];
  if (!tipo) avisos.push(`El tipo "${d.tipo}" no tiene equivalencia conocida en el CRM`);

  const propietario = (ficha.propietarios || []).find((p) => p?.nombre?.trim() || p?.telefono?.trim());
  if (!propietario) avisos.push("La ficha no tiene propietario: el CRM lo aceptará sin contacto");
  const { Nombre, Apellidos } = partirNombre(propietario?.nombre);

  if ((ficha.propietarios || []).filter((p) => p?.nombre?.trim()).length > 1) {
    avisos.push("Hay más de un propietario; grabar_inmueble solo admite uno. El resto se añade con grabar_contacto + actualizar_propietarios");
  }

  const equip = d.equipamiento;
  const precio = entero(d.precio);
  if (precio === undefined) avisos.push("La ficha no tiene precio");

  const datos = {
    /* Obligatorios */
    Ref_Intranet: refIntranet(ficha),
    Tipo: tipo || d.tipo,
    Estado: "Disponible",
    Operacion: d.operacion || "Venta",
    Direccion: d.direccion,

    /* Propietario, que el CRM acepta en la misma llamada */
    Nombre_contacto: Nombre || undefined,
    Apellidos_contacto: Apellidos || undefined,
    Telefono_contacto: propietario?.telefono ? String(propietario.telefono).replace(/\D/g, "") : undefined,
    Email_contacto: propietario?.email || undefined,

    /* Ubicación */
    Numero: d.numero,
    Puerta: d.puerta,
    Planta: entero(d.planta),
    Provincia: d.provincia,
    Municipio: d.poblacion,
    Poblacion: d.poblacion,

    /* Económicos y superficies */
    Precio: precio,
    Dormitorios: entero(d.dormitorios),
    Banos: entero(d.banos),
    Aseos: entero(d.aseos),
    Antiguedad: entero(d.anio),
    Metros_Utiles: numero(d.mUtiles),
    Metros_Construidos: numero(d.mConstruidos),
    Metros_Parcela: numero(d.mParcela),
    Metros_Terraza: numero(d.mTerraza),
    Metros_Fachada: numero(d.escaparate),

    /* Extras: los nuestros son etiquetas, los suyos números o 0/1 */
    Ascensor: siNo(d.ascensor),
    Piscina: tieneEn(equip, "Piscina") || tieneEn(d.zonasComunes, "Piscina") || undefined,
    Jardin: tieneEn(equip, "Jardín") || tieneEn(d.zonasComunes, "Jardines") || undefined,
    Terraza: tieneEn(equip, "Terraza"),
    Garaje: tieneEn(equip, "Garaje"),
    Trastero: tieneEn(equip, "Trastero"),
    es_atico: d.tipo === "Ático" ? 1 : undefined,
    CheckVistasMar: tieneEn(d.vistas, "Al mar"),
    CheckVistasDestacadas: tieneEn(d.vistas, "Despejadas"),

    /* Textos */
    Observaciones_Publicas: d.descripcionPublica || undefined,
    Observaciones_Privadas: observacionesPrivadas(ficha) || undefined,
  };

  /* Fuera los vacíos: el CRM no tiene por qué recibir campos sin valor. */
  const limpio = Object.fromEntries(
    Object.entries(datos).filter(([, v]) => v !== undefined && v !== null && v !== "")
  );

  const faltan = ["Ref_Intranet", "Tipo", "Estado", "Operacion", "Direccion"].filter((k) => !limpio[k]);

  return { ok: faltan.length === 0, faltan, datos: limpio, avisos };
}

/* Propietario → cuerpo de grabar_contacto, para el segundo y siguientes. */
export function propietarioAContacto(propietario, ficha) {
  const { Nombre, Apellidos } = partirNombre(propietario?.nombre);
  const d = ficha?.data || {};
  const datos = {
    Nombre: Nombre || undefined,
    Apellidos: Apellidos || undefined,
    Movil: propietario?.telefono ? String(propietario.telefono).replace(/\D/g, "") : undefined,
    Email: propietario?.email || undefined,
    CIF_NIF: propietario?.dni || undefined,
    Provincia: d.provincia || undefined,
    Poblacion: d.poblacion || undefined,
    CP: d.cp ? entero(d.cp) : undefined,
  };
  const limpio = Object.fromEntries(Object.entries(datos).filter(([, v]) => v !== undefined && v !== ""));
  /* El CRM exige email o móvil. */
  return { ok: Boolean(limpio.Movil || limpio.Email), datos: limpio };
}
