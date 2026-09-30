/* Envío de la ficha de captación a IA Gestión.

   CÓMO FUNCIONA (todo comprobado contra la API real el 2026-09-30, no sale del
   manual, que se equivoca en nombres y no dice qué se puede escribir):

   1. El inmueble YA EXISTE: lo crea /enviar-exclusiva-firmada al convertir el
      prospecto. Aquí nunca se crea nada: se busca por Ref_CRM y se ACTUALIZA con
      actualizar_inmueble.
   2. La API tiene una lista blanca FIJA y pequeña. Lo que no está en ella se
      descarta en silencio (responde "actualizado: true" igualmente). Por eso
      todo lo que no se puede subir va como texto a Observaciones_Privadas.
   3. Trampas conocidas que este módulo evita:
      - actualizar_inmueble SIN `Fecha` pone la fecha del inmueble a 0000-00-00.
        Se lee la actual y se reenvía SIEMPRE.
      - Orientacion pasa la lista blanca pero se guarda vacía → no se envía nunca.
      - CheckPortalesWeb = 1 lo deja en "no" (despublica de la web) → no se envía.
      - Tipo con el valor que devuelve la lectura ("Pisos") deja el tipo vacío o
        da un 400. Solo se manda Tipo si el inmueble no lo tiene, y con el
        vocabulario de ENTRADA ("Piso", "Casa"…).
      - Jardin=true / Exclusiva="Sí" guardan "no"/0: se usan 1/0 y "si" sin tilde.
      - Estado_General traduce con pérdida ("Entrar a vivir" acaba en "Sencillo").
      - HonorariosCedidosPorcentaje es OTRA cosa (honorarios cedidos), no se usa.

   Aislado y sin efectos secundarios en fichaAParametros para poder probarlo y
   VER lo que se enviaría antes de escribir nada.  */

import { parseNumero } from "../src/lib/validacion.js";

export const BASE = "https://pasarelas.iagestion.com/api-gestioninmo/v2";

/* La API es PHP y espera los parámetros como formulario, no como JSON. */
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
  const datos = parsearJson(texto);
  if (datos === null) {
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
  /* El CRM devuelve 200 incluso cuando falla: hay que mirar el contenido. */
  if (datos?.error) {
    return { ok: false, estado: respuesta.status, error: String(datos.message || "Error del CRM"), datos };
  }
  return { ok: true, estado: respuesta.status, datos };
}

/* A veces responde con DOS objetos JSON pegados (p. ej. un 400 que aun así
   ejecuta el resto de la actualización). Se devuelve el primero. */
export function parsearJson(texto) {
  try {
    return JSON.parse(texto);
  } catch {
    let prof = 0;
    let enCadena = false;
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (enCadena) {
        if (c === "\\") i++;
        else if (c === '"') enCadena = false;
      } else if (c === '"') enCadena = true;
      else if (c === "{") prof++;
      else if (c === "}" && --prof === 0) {
        try {
          return JSON.parse(texto.slice(texto.indexOf("{"), i + 1));
        } catch {
          return null;
        }
      }
    }
    return null;
  }
}

/* ----------------------------------------------------------------------------
   Nombres
   ------------------------------------------------------------------------- */

/* Lista blanca REAL de escritura, con el nombre de ENTRADA (a veces distinto del
   de lectura). Cualquier parámetro que no esté aquí no se envía jamás. */
export const ESCRIBIBLES = new Set([
  "Precio", "Direccion", "Numero", "Planta", "Puerta", "CP", "Provincia", "Municipio", "Poblacion", "RC",
  "Antiguedad", "Exclusiva", "Observaciones_Publicas", "Observaciones_Privadas",
  "Metros_Construidos", "Metros_Utiles", "Metros_Parcela", "Metros_Terraza", "Metros_Salon", "Metros_Fachada",
  "Dormitorios", "Banos", "Aseos", "Ascensor", "Terraza", "Trastero", "Garajes", "Piscina", "Jardin",
  "es_atico", "es_duplex",
  "IBI", "Gastos_Comunidad", "Certificado_Energetico", "Calefaccion", "Estado_General",
  "CheckVentanasPVC", "CheckVentanasAluminio", "CheckVentanasMadera", "CheckVentanasClimalit",
  "CheckSueloParquet", "CheckSueloTarima", "CheckSueloCeramicaGress",
  "CheckVistasMar", "CheckVistasDestacadas",
  "Tipo",
]);

/* Nombre de entrada → columna que se lee después (para verificar lo guardado). */
const COLUMNA = { Jardin: "CheckJardin", es_atico: "CheckAtico", es_duplex: "CheckDuplex" };
const columnaDe = (param) => COLUMNA[param] || param;

/* Estado_General: la API solo acepta estas 5 palabras y las traduce. */
const ESTADO_GENERAL = {
  "Para entrar": { envia: "Buen estado", guarda: "Buen estado", nota: "Para entrar" },
  "Buen estado": { envia: "Buen estado", guarda: "Buen estado" },
  "A reformar": { envia: "Para reformar", guarda: "A reformar" },
  "A estrenar": { envia: "Nuevo", guarda: "A estrenar" },
};

/* Tipo de ENTRADA (no el de lectura). Solo se usa si el inmueble no tiene tipo. */
const TIPO_ENTRADA = {
  "Piso": "Piso",
  "Ático": "Ático",
  "Casa / Chalet": "Casa",
  "Local": "Local",
  "Terreno": "Parcela",
  "Garaje": "Garaje",
};

/* ----------------------------------------------------------------------------
   Ficha → parámetros
   ------------------------------------------------------------------------- */

const t = (v) => String(v ?? "").trim();
const entero = (v) => {
  const n = parseNumero(v);
  return n === null ? undefined : Math.round(n);
};
const decimal = (v) => {
  const n = parseNumero(v);
  return n === null ? undefined : n;
};
const tiene = (lista, valor) => Array.isArray(lista) && lista.includes(valor);
const lista = (v) => (Array.isArray(v) ? v : []);

/* "#5618" / "05618" / "5618" → "05618", que es como está en Ref_CRM. */
export function normalizarReferencia(v) {
  const dig = t(v).replace(/^#/, "").replace(/\D/g, "");
  return dig ? dig.padStart(5, "0") : "";
}

/* Devuelve { parametros, lineas, avisos }.
   - parametros: solo lo que la API guarda de verdad, ya con sus valores válidos.
   - lineas: lo que NO se puede subir, como pares [etiqueta, valor] para las
     observaciones privadas.
   `actual` es el inmueble tal como está en IA Gestión (o null en la vista previa
   sin conexión). */
export function fichaAParametros(ficha, actual = null) {
  const d = ficha?.data || {};
  const p = {};
  const lineas = [];
  const avisos = [];

  const poner = (k, v) => {
    if (v === undefined || v === null || v === "" || (typeof v === "number" && !Number.isFinite(v))) return;
    p[k] = v;
  };
  const linea = (etiqueta, valor) => {
    const v = Array.isArray(valor) ? valor.join(", ") : t(valor);
    if (v) lineas.push([etiqueta, v]);
  };
  const si = "si";

  /* Ubicación */
  poner("Direccion", t(d.direccion));
  poner("Numero", t(d.numero));
  poner("Planta", t(d.planta));
  poner("Puerta", t(d.puerta));
  poner("CP", t(d.cp));
  poner("Provincia", t(d.provincia));
  poner("Poblacion", t(d.poblacion));
  poner("Municipio", t(d.poblacion));
  poner("RC", t(d.refCatastral).toUpperCase().replace(/\s+/g, ""));
  linea("Bloque / escalera", d.bloque);

  /* Tipo: solo si IA Gestión no lo tiene (lo puso /enviar-exclusiva-firmada con
     el texto libre del agente y, si no era un valor válido, quedó vacío). */
  if (actual && !t(actual.Tipo)) {
    const tipo = TIPO_ENTRADA[d.tipo];
    if (tipo) {
      poner("Tipo", tipo);
      avisos.push(`El inmueble no tenía tipo en IA Gestión: se ha puesto "${tipo}". Revísalo.`);
    } else {
      avisos.push("El inmueble no tiene tipo en IA Gestión y la ficha no trae uno reconocible: ponlo a mano.");
    }
  }
  if (d.tipo === "Ático") poner("es_atico", 1);

  /* Económicos */
  poner("Precio", entero(d.precio));
  poner("IBI", decimal(d.ibi));
  poner("Gastos_Comunidad", decimal(d.comunidad));
  linea("Precio mínimo aceptable", d.precioMin && `${d.precioMin} €`);
  if (d.derrama) linea("Derrama aprobada", d.derrama === "Sí" && d.derramaImporte ? `Sí, ${d.derramaImporte} €` : d.derrama);
  if (d.vpo) linea("VPO", d.vpo === "Sí" && d.vpoExp ? `Sí, expediente ${d.vpoExp}` : d.vpo);
  if (d.honorarios) {
    linea("Honorarios pactados", d.honorariosValor ? `${d.honorarios} — ${d.honorariosValor}` : d.honorarios);
  }
  /* Autorización de venta / régimen → Exclusiva (1/0). "Sí" con tilde guardaría 0. */
  if (d.autorizacion === "Sí" && d.exclusiva === "Exclusiva") poner("Exclusiva", 1);
  else if (d.autorizacion === "Sí" && d.exclusiva === "Sin exclusiva") poner("Exclusiva", 0);
  else linea("Autorización de venta firmada", d.autorizacion);

  /* Situación legal */
  if (d.cargas) linea("Cargas", d.cargas === "No" ? "No" : `${d.cargas}${d.cargasDetalle ? ` — ${d.cargasDetalle}` : ""}`);
  if (d.ocupacion) linea("Situación", d.ocupacion === "Alquilado" && d.finAlquiler ? `Alquilado hasta ${d.finAlquiler}` : d.ocupacion);
  linea("Clasificación del suelo", d.suelo);
  linea("Documentación aportada", d.docs);

  /* Certificado energético: letra, "EN TRAMITE" o "EXENTO", como los usa IA Gestión */
  if (d.cee === "Hecho" && d.ceeLetra) poner("Certificado_Energetico", d.ceeLetra);
  else if (d.cee === "Pendiente") poner("Certificado_Energetico", "EN TRAMITE");
  else if (d.cee === "Exento") poner("Certificado_Energetico", "EXENTO");

  /* Superficies y distribución */
  poner("Metros_Construidos", decimal(d.mConstruidos));
  poner("Metros_Utiles", decimal(d.mUtiles));
  poner("Metros_Parcela", decimal(d.mParcela));
  poner("Metros_Terraza", decimal(d.mTerraza));
  poner("Metros_Salon", decimal(d.salon));
  poner("Metros_Fachada", decimal(d.escaparate));
  poner("Antiguedad", entero(d.anio));
  poner("Dormitorios", entero(d.dormitorios));
  poner("Banos", entero(d.banos));
  poner("Aseos", entero(d.aseos));
  linea("Cocina (m²)", d.cocinaM);
  linea("Alturas del edificio", d.alturas);
  linea("Edificabilidad", d.edificabilidad);
  linea("Plazas de aparcamiento", d.plazas);
  linea("Salida de humos", d.salidaHumos);

  /* Extras: solo se marca lo presente, nunca se pone a 0 lo que la oficina pudo rellenar */
  if (d.ascensor === "Sí") poner("Ascensor", 1);
  else if (d.ascensor === "No") poner("Ascensor", 0);
  const eq = d.equipamiento;
  if (tiene(eq, "Terraza")) poner("Terraza", 1);
  if (tiene(eq, "Trastero")) poner("Trastero", 1);
  if (tiene(eq, "Garaje")) poner("Garajes", 1);
  if (tiene(eq, "Piscina") || tiene(d.zonasComunes, "Piscina")) poner("Piscina", 1);
  if (tiene(eq, "Jardín")) poner("Jardin", 1);
  linea("Equipamiento sin campo en el CRM", lista(eq).filter((x) => ["Armarios empotrados", "Balcón", "Buhardilla"].includes(x)));
  linea("Zonas comunes", lista(d.zonasComunes).filter((x) => x !== "Piscina"));
  linea("Conserjería / vigilancia", d.conserjeria);
  linea("A cota cero", d.cotaCero);

  /* Calidades */
  for (const [chip, col] of [["Aluminio", "CheckVentanasAluminio"], ["PVC", "CheckVentanasPVC"], ["Madera", "CheckVentanasMadera"], ["Climalit", "CheckVentanasClimalit"]]) {
    if (tiene(d.ventanaMat, chip)) poner(col, si);
  }
  linea("Tipo de apertura de ventanas", d.ventanaApertura);
  linea("Puertas interiores", d.puertas);
  if (tiene(d.suelos, "Tarima")) poner("CheckSueloTarima", si);
  if (tiene(d.suelos, "Gres") || tiene(d.suelos, "Porcelánico")) poner("CheckSueloCeramicaGress", si);
  linea("Suelos sin campo en el CRM", lista(d.suelos).filter((x) => ["Terrazo", "Mármol"].includes(x)));
  linea("Cocina", d.cocinaTipo);
  linea("Fuegos", d.fuegos);
  linea("Agua caliente", d.acs);
  linea("Climatización", d.clima);
  linea("Paredes", d.paredes);

  /* Calefacción: un solo valor; si hay varios, el primero y el resto al texto */
  const cal = lista(d.calefaccion);
  if (cal.length) {
    const reales = cal.filter((x) => x !== "No tiene");
    if (!reales.length) poner("Calefaccion", "No tiene calefacción");
    else {
      poner("Calefaccion", reales[0]);
      if (reales.length > 1) linea("Otra calefacción", reales.slice(1));
    }
  }

  /* Estado de conservación */
  const est = ESTADO_GENERAL[d.estado];
  if (est) {
    poner("Estado_General", est.envia);
    if (est.nota) linea("Estado de conservación", `${est.nota} (IA Gestión no permite guardar "Entrar a vivir" por API)`);
  }

  /* Edificio y entorno */
  if (tiene(d.vistas, "Al mar")) poner("CheckVistasMar", si);
  if (tiene(d.vistas, "Despejadas")) poner("CheckVistasDestacadas", si);
  linea("Vistas sin campo en el CRM", lista(d.vistas).filter((x) => ["A la montaña", "Interior"].includes(x)));
  linea("Orientación", d.orientacion);   // Orientacion no se puede escribir (se guarda vacía)
  linea("Fachada", d.fachada);
  linea("Acceso rodado", d.acceso);
  linea("Suministros", d.suministros);
  linea("Servicios a 5 min", d.servicios);

  /* Textos */
  poner("Observaciones_Publicas", t(d.descripcionPublica));

  /* Solo lo que la API acepta: red de seguridad frente a errores de este fichero */
  for (const k of Object.keys(p)) {
    if (!ESCRIBIBLES.has(k)) {
      delete p[k];
      avisos.push(`Parámetro no permitido descartado: ${k}`);
    }
  }
  return { parametros: p, lineas, avisos };
}

/* ----------------------------------------------------------------------------
   Observaciones privadas: el texto de la ficha va entre marcas, así se puede
   volver a subir sin duplicarlo ni pisar lo que la oficina haya escrito.
   IA Gestión guarda las observaciones en HTML (<p>…</p>).
   ------------------------------------------------------------------------- */

export const MARCA_INI = "── Ficha de captación ──";
export const MARCA_FIN = "── fin ficha de captación ──";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function bloqueFicha(ficha, lineas) {
  const cabecera = `Captada por ${ficha.agenteName || "—"}${ficha.creada ? ` el ${new Date(ficha.creada).toLocaleDateString("es-ES")}` : ""}`;
  const cuerpo = [["", cabecera], ...lineas]
    .map(([k, v]) => `<p>${k ? `<strong>${esc(k)}:</strong> ` : ""}${esc(v)}</p>`)
    .join("");
  return `<p><strong>${MARCA_INI}</strong></p>${cuerpo}<p><em>${MARCA_FIN}</em></p>`;
}

export function componerObservaciones(actual, ficha, lineas) {
  const bloque = bloqueFicha(ficha, lineas);
  const prev = String(actual ?? "");
  const notas = t(ficha?.data?.notasInternas);
  const notasHtml = notas ? notas.split(/\n+/).map((l) => `<p>${esc(l)}</p>`).join("") : "";

  const re = new RegExp(`<p><strong>${MARCA_INI}</strong></p>[\\s\\S]*?<p><em>${MARCA_FIN}</em></p>`);
  if (re.test(prev)) return prev.replace(re, bloque);              // volver a subir: se reemplaza solo nuestro bloque
  return `${prev}${notasHtml}${bloque}`;                           // primera vez: se añade al final, sin tocar lo que hay
}

/* ----------------------------------------------------------------------------
   Con conexión: buscar, previsualizar, subir
   ------------------------------------------------------------------------- */

export async function buscarInmueble(ref, llamar = llamarIagestion) {
  const r = await llamar("inmueble", { Ref: ref });
  if (!r.ok) return { ok: false, error: r.error };
  const inm = r.datos?.inmueble;
  if (!inm || !inm.Id) return { ok: false, noExiste: true, error: `No hay ningún inmueble con la referencia ${ref} en IA Gestión` };
  return { ok: true, inmueble: inm };
}

function resumenInmueble(i) {
  return { Id: i.Id, Ref_CRM: i.Ref_CRM, Tipo: i.Tipo, Estado: i.Estado, Fecha: i.Fecha, Direccion: i.Direccion };
}

const fechaValida = (f) => Boolean(f) && !String(f).startsWith("0000");

/* Prepara todo lo que se enviaría, sin escribir nada. */
export async function prepararSubida(ficha, llamar = llamarIagestion) {
  const ref = normalizarReferencia(ficha?.data?.referencia);
  if (!ref) return { ok: false, error: "La ficha no tiene referencia: sin ella no se sabe qué inmueble de IA Gestión actualizar." };

  const b = await buscarInmueble(ref, llamar);
  if (!b.ok) return { ok: false, error: b.error, noExiste: b.noExiste, ref };
  const actual = b.inmueble;

  const { parametros, lineas, avisos } = fichaAParametros(ficha, actual);
  parametros.Observaciones_Privadas = componerObservaciones(actual.Observaciones_Privadas, ficha, lineas);

  if (actual.Estado === "Baja") return { ok: false, error: "El inmueble está de baja en IA Gestión: no se actualiza.", ref, inmueble: resumenInmueble(actual) };
  if (!fechaValida(actual.Fecha)) {
    avisos.push("El inmueble no tiene fecha válida en IA Gestión (0000-00-00): se conserva tal cual, no se toca.");
  }
  if (["Vendido", "Alquilado", "Reservado"].includes(actual.Estado)) {
    avisos.push(`El inmueble está en estado "${actual.Estado}" en IA Gestión.`);
  }
  return { ok: true, ref, actual, parametros, lineas, avisos, inmueble: resumenInmueble(actual) };
}

/* Las casillas se envían como 1/0 o "si" y el CRM las guarda como "si"/"no". */
const unificar = (v) => {
  const x = String(v ?? "").trim().toLowerCase();
  return x === "si" ? "1" : x === "no" ? "0" : x;
};

function coincide(esperado, leido) {
  const a = unificar(esperado);
  const b = unificar(leido);
  if (a === b) return true;
  const na = Number(a.replace(",", "."));
  const nb = Number(b.replace(",", "."));
  return Number.isFinite(na) && Number.isFinite(nb) && Math.abs(na - nb) < 1e-6;
}

/* Sube la ficha y VERIFICA releyendo el inmueble: la API dice "actualizado"
   aunque no haya guardado nada. */
export async function subirFicha(ficha, llamar = llamarIagestion) {
  const prep = await prepararSubida(ficha, llamar);
  if (!prep.ok) return prep;
  const { actual, parametros } = prep;

  const envio = { Id_Inmueble: actual.Id, ...parametros };
  /* Reenviar la Fecha actual evita que la API la ponga a 0000-00-00. */
  if (fechaValida(actual.Fecha)) envio.Fecha = actual.Fecha;

  const r = await llamar("actualizar_inmueble", envio);
  /* Aunque responda mal se relee: a veces falla el aviso pero se aplica. */
  const b2 = await buscarInmueble(prep.ref, llamar);
  if (!b2.ok) return { ...prep, ok: false, error: r.ok ? b2.error : (r.error || b2.error) };
  const nuevo = b2.inmueble;

  const aplicados = [];
  const noGuardados = [];
  for (const [k, v] of Object.entries(parametros)) {
    const col = columnaDe(k);
    if (k === "Observaciones_Privadas") {
      (String(nuevo[col] || "").includes(MARCA_INI) ? aplicados : noGuardados).push({ campo: k });
      continue;
    }
    if (k === "Tipo") {
      /* Se envía "Piso" y se guarda "Pisos": basta con que ya no esté vacío. */
      (t(nuevo.Tipo) ? aplicados : noGuardados).push({ campo: "Tipo", enviado: v, leido: nuevo.Tipo ?? null });
      continue;
    }
    let esperado = v;
    if (k === "Estado_General") {
      esperado = Object.values(ESTADO_GENERAL).find((e) => e.envia === v)?.guarda ?? v;
    }
    if (coincide(esperado, nuevo[col])) aplicados.push({ campo: col, valor: nuevo[col] });
    else noGuardados.push({ campo: col, enviado: v, leido: nuevo[col] ?? null });
  }

  const fechaIntacta = !fechaValida(actual.Fecha) || nuevo.Fecha === actual.Fecha;
  return {
    ...prep,
    ok: noGuardados.length === 0 && fechaIntacta,
    respuestaOk: r.ok,
    aplicados,
    noGuardados,
    fechaIntacta,
    error: !fechaIntacta ? "La fecha del inmueble ha cambiado tras la subida: revisar en IA Gestión." : (r.ok ? undefined : r.error),
  };
}
