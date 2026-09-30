import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fichaAParametros, prepararSubida, subirFicha, componerObservaciones, normalizarReferencia,
  parsearJson, ESCRIBIBLES, MARCA_INI, MARCA_FIN,
} from "../api/_iagestion.js";

/* Un CRM de mentira que imita las trampas REALES de la API (comprobadas en vivo):
   - lista blanca: lo demás se descarta y aun así responde "actualizado: true"
   - alias de entrada (es_atico → CheckAtico, Jardin → CheckJardin)
   - "Piso" se guarda como "Pisos"; Estado_General traduce con pérdida
   - actualizar SIN Fecha pone la fecha a 0000-00-00 */
function crmSimulado(inicial = {}) {
  const inmueble = {
    Id: 777, Ref_CRM: "05618", Tipo: "Pisos", Estado: "Pendiente", Fecha: "2026-09-01 10:00:00",
    Observaciones_Privadas: "<p>llaves en la agencia</p>", Direccion: "calle vieja",
    ...inicial,
  };
  const llamadas = [];
  const ALIAS = { es_atico: ["CheckAtico", "si"], es_duplex: ["CheckDuplex", "si"], Jardin: ["CheckJardin", "si"] };
  const ESTADO = { Nuevo: "A estrenar", "Buen estado": "Buen estado", "Para reformar": "A reformar" };
  const llamar = async (servicio, params) => {
    llamadas.push({ servicio, params });
    if (servicio === "inmueble") {
      return params.Ref === inmueble.Ref_CRM ? { ok: true, datos: { inmueble: { ...inmueble } } } : { ok: true, datos: [] };
    }
    if (servicio === "actualizar_inmueble") {
      if (!("Fecha" in params)) inmueble.Fecha = "0000-00-00 00:00:00";
      for (const [k, v] of Object.entries(params)) {
        if (["Id_Inmueble", "Fecha"].includes(k)) continue;
        if (ALIAS[k]) { inmueble[ALIAS[k][0]] = ALIAS[k][1]; continue; }
        if (!ESCRIBIBLES.has(k)) continue;                        // silenciosamente descartado
        if (k === "Tipo") { inmueble.Tipo = v === "Piso" ? "Pisos" : v; continue; }
        if (k === "Estado_General") { if (ESTADO[v]) inmueble.Estado_General = ESTADO[v]; continue; }
        inmueble[k] = v;
      }
      return { ok: true, datos: { actualizado: true } };
    }
    return { ok: false, error: `servicio no simulado: ${servicio}` };
  };
  return { llamar, inmueble, llamadas };
}

const ficha = (data = {}) => ({
  id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
  creada: "2026-09-01T10:00:00.000Z",
  agenteName: "Eva Vallés",
  propietarios: [{ nombre: "Carmen Ferrer Ros", telefono: "666 55 44 33" }],
  data: { operacion: "Venta", tipo: "Piso", direccion: "Calle Colón", referencia: "#5618", ...data },
});

test("la referencia se normaliza a las 5 cifras de Ref_CRM", () => {
  assert.equal(normalizarReferencia("#5618"), "05618");
  assert.equal(normalizarReferencia("05618"), "05618");
  assert.equal(normalizarReferencia("5618"), "05618");
  assert.equal(normalizarReferencia(""), "");
});

test("los números en formato español se convierten a los suyos", () => {
  const { parametros: p } = fichaAParametros(ficha({
    precio: "385.000", mUtiles: "298,5", mConstruidos: "321", anio: "1940", dormitorios: "4", ibi: "364,15", comunidad: "50",
  }));
  assert.equal(p.Precio, 385000);
  assert.equal(p.Metros_Utiles, 298.5);
  assert.equal(p.Metros_Construidos, 321);
  assert.equal(p.Antiguedad, 1940);
  assert.equal(p.Dormitorios, 4);
  assert.equal(p.IBI, 364.15);
  assert.equal(p.Gastos_Comunidad, 50);
});

test("la planta y la puerta viajan como texto: 'Bajo' no se pierde", () => {
  const { parametros: p } = fichaAParametros(ficha({ planta: "Bajo", puerta: "3B" }));
  assert.equal(p.Planta, "Bajo");
  assert.equal(p.Puerta, "3B");
});

test("nunca se envía lo peligroso ni lo que la API descarta", () => {
  const { parametros: p } = fichaAParametros(ficha({
    orientacion: ["Sur"], derrama: "Sí", derramaImporte: "200", honorarios: "% sobre venta", honorariosValor: "3",
    cargas: "Hipoteca", ocupacion: "Libre", vpo: "Sí", cocinaTipo: "Americana", acs: ["Aerotermia"],
  }));
  for (const k of ["Orientacion", "CheckPortalesWeb", "Derrama", "HonorariosPorcentaje", "HonorariosCedidosPorcentaje",
    "Cargas", "CheckCargas", "Cocina", "Agua_Caliente", "Estado", "Operacion"]) {
    assert.ok(!(k in p), `${k} no debe enviarse`);
  }
  for (const k of Object.keys(p)) assert.ok(ESCRIBIBLES.has(k), `${k} no está en la lista blanca real`);
});

test("lo que no se puede subir queda como texto para las observaciones", () => {
  const { lineas } = fichaAParametros(ficha({
    derrama: "Sí", derramaImporte: "200", cargas: "Hipoteca", cargasDetalle: "Banco X", honorarios: "% sobre venta", honorariosValor: "3",
    vpo: "Sí", vpoExp: "V-1", orientacion: ["Sur", "Este"], acs: ["Aerotermia"], bloque: "B",
  }));
  const mapa = Object.fromEntries(lineas);
  assert.equal(mapa["Derrama aprobada"], "Sí, 200 €");
  assert.equal(mapa["Cargas"], "Hipoteca — Banco X");
  assert.equal(mapa["Honorarios pactados"], "% sobre venta — 3");
  assert.equal(mapa["VPO"], "Sí, expediente V-1");
  assert.equal(mapa["Orientación"], "Sur, Este");
  assert.equal(mapa["Agua caliente"], "Aerotermia");
  assert.equal(mapa["Bloque / escalera"], "B");
});

test("alias, 1/0 y 'si' sin tilde: lo que la API guarda bien", () => {
  const { parametros: p } = fichaAParametros(ficha({
    tipo: "Ático", autorizacion: "Sí", exclusiva: "Exclusiva", ascensor: "Sí",
    equipamiento: ["Jardín", "Piscina", "Terraza", "Trastero", "Garaje"],
    ventanaMat: ["Aluminio", "Climalit"], suelos: ["Tarima", "Gres"], vistas: ["Al mar", "Despejadas"],
  }));
  assert.equal(p.es_atico, 1);
  assert.equal(p.Exclusiva, 1, "1, no 'Sí': con tilde la API guarda 0");
  assert.equal(p.Ascensor, 1);
  assert.equal(p.Jardin, 1, "true o 'Sí' guardarían 'no'");
  assert.equal(p.Piscina, 1);
  assert.equal(p.Garajes, 1, "con 's': Garaje se ignora");
  assert.equal(p.CheckVentanasAluminio, "si");
  assert.equal(p.CheckVentanasClimalit, "si");
  assert.equal(p.CheckSueloTarima, "si");
  assert.equal(p.CheckSueloCeramicaGress, "si");
  assert.equal(p.CheckVistasMar, "si");
  assert.equal(p.CheckVistasDestacadas, "si");
});

test("certificado energético con el vocabulario de IA Gestión", () => {
  assert.equal(fichaAParametros(ficha({ cee: "Hecho", ceeLetra: "E" })).parametros.Certificado_Energetico, "E");
  assert.equal(fichaAParametros(ficha({ cee: "Pendiente" })).parametros.Certificado_Energetico, "EN TRAMITE");
  assert.equal(fichaAParametros(ficha({ cee: "Exento" })).parametros.Certificado_Energetico, "EXENTO");
});

test("estado de conservación: solo las 5 palabras que la API acepta", () => {
  assert.equal(fichaAParametros(ficha({ estado: "A estrenar" })).parametros.Estado_General, "Nuevo");
  assert.equal(fichaAParametros(ficha({ estado: "A reformar" })).parametros.Estado_General, "Para reformar");
  const r = fichaAParametros(ficha({ estado: "Para entrar" }));
  assert.equal(r.parametros.Estado_General, "Buen estado", "'Entrar a vivir' acabaría como 'Sencillo'");
  assert.ok(r.lineas.some(([k]) => k === "Estado de conservación"), "la diferencia queda anotada");
});

test("calefacción: un solo valor; el resto pasa al texto", () => {
  const r = fichaAParametros(ficha({ calefaccion: ["Gas", "Eléctrica"] }));
  assert.equal(r.parametros.Calefaccion, "Gas");
  assert.deepEqual(r.lineas.find(([k]) => k === "Otra calefacción"), ["Otra calefacción", "Eléctrica"]);
  assert.equal(fichaAParametros(ficha({ calefaccion: ["No tiene"] })).parametros.Calefaccion, "No tiene calefacción");
});

test("el tipo solo se manda si el inmueble no lo tiene, y con el vocabulario de ENTRADA", () => {
  assert.ok(!("Tipo" in fichaAParametros(ficha(), { Tipo: "Pisos" }).parametros));
  const r = fichaAParametros(ficha({ tipo: "Casa / Chalet" }), { Tipo: null });
  assert.equal(r.parametros.Tipo, "Casa");
  assert.ok(r.avisos.length, "queda avisado para revisar");
});

test("las observaciones: primera vez se añade sin tocar lo que hay; re-subir reemplaza solo el bloque", () => {
  const f = ficha({ notasInternas: "Ojo con el vecino" });
  const lineas = [["Cargas", "Hipoteca — Banco <X> & Cía"]];
  const primera = componerObservaciones("<p>llaves en la agencia</p>", f, lineas);
  assert.ok(primera.startsWith("<p>llaves en la agencia</p>"), "lo que ya había se conserva");
  assert.ok(primera.includes("Ojo con el vecino"));
  assert.ok(primera.includes(MARCA_INI) && primera.includes(MARCA_FIN));
  assert.ok(primera.includes("Banco &lt;X&gt; &amp; Cía"), "el texto va escapado");

  const segunda = componerObservaciones(`${primera}<p>nota añadida después por la oficina</p>`, f, [["Cargas", "No"]]);
  assert.equal(segunda.split(MARCA_INI).length - 1, 1, "el bloque no se duplica");
  assert.ok(segunda.includes("nota añadida después por la oficina"), "no pisa lo que escribió la oficina");
  assert.ok(segunda.includes("<strong>Cargas:</strong> No"));
  assert.ok(!segunda.includes("Hipoteca"), "el bloque se ha actualizado");
});

test("parsearJson aguanta los dos JSON pegados que devuelve la API en un 400", () => {
  assert.deepEqual(parsearJson('{"a":1}{"b":2}'), { a: 1 });
  assert.deepEqual(parsearJson('{"a":"}{"}{"b":2}'), { a: "}{" });
  assert.equal(parsearJson("no es json"), null);
});

/* ---------------------------------------------------------------- subida */

test("subir: actualiza el inmueble existente, verifica y CONSERVA la Fecha", async () => {
  const crm = crmSimulado();
  const r = await subirFicha(ficha({ precio: "200.000", dormitorios: "3", ibi: "145", tipo: "Ático", estado: "A estrenar" }), crm.llamar);
  assert.equal(r.ok, true, JSON.stringify(r.noGuardados));
  assert.equal(r.fechaIntacta, true);
  assert.equal(crm.inmueble.Fecha, "2026-09-01 10:00:00", "sin reenviar Fecha la API la pone a 0000-00-00");
  assert.equal(crm.inmueble.Precio, 200000);
  assert.equal(crm.inmueble.CheckAtico, "si");
  assert.equal(crm.inmueble.Estado_General, "A estrenar");
  assert.ok(crm.inmueble.Observaciones_Privadas.startsWith("<p>llaves en la agencia</p>"));
  assert.ok(!crm.llamadas.some((l) => l.servicio === "grabar_inmueble"), "nunca se crea un inmueble");
  const upd = crm.llamadas.find((l) => l.servicio === "actualizar_inmueble").params;
  assert.equal(upd.Id_Inmueble, 777);
  assert.equal(upd.Fecha, "2026-09-01 10:00:00");
});

test("subir dos veces no duplica el bloque de observaciones", async () => {
  const crm = crmSimulado();
  const f = ficha({ cargas: "No" });
  await subirFicha(f, crm.llamar);
  await subirFicha(f, crm.llamar);
  assert.equal(crm.inmueble.Observaciones_Privadas.split(MARCA_INI).length - 1, 1);
});

test("si un campo no se guarda, se dice cuál (no basta con el 'actualizado: true')", async () => {
  const crm = crmSimulado();
  const original = crm.llamar;
  const llamarQueIgnora = async (s, p) => {
    if (s === "actualizar_inmueble") delete p.IBI;          // la API lo tira sin avisar
    return original(s, p);
  };
  const r = await subirFicha(ficha({ ibi: "145", precio: "100.000" }), llamarQueIgnora);
  assert.equal(r.ok, false);
  assert.deepEqual(r.noGuardados.map((x) => x.campo), ["IBI"]);
  assert.ok(r.aplicados.some((x) => x.campo === "Precio"));
});

test("errores claros: sin referencia, inmueble inexistente, dado de baja", async () => {
  const crm = crmSimulado();
  const sin = await subirFicha(ficha({ referencia: "" }), crm.llamar);
  assert.equal(sin.ok, false);
  assert.match(sin.error, /no tiene referencia/);

  const otra = await subirFicha(ficha({ referencia: "9999" }), crm.llamar);
  assert.equal(otra.ok, false);
  assert.equal(otra.noExiste, true);

  const baja = crmSimulado({ Estado: "Baja" });
  const rb = await subirFicha(ficha(), baja.llamar);
  assert.equal(rb.ok, false);
  assert.match(rb.error, /de baja/);
  assert.ok(!baja.llamadas.some((l) => l.servicio === "actualizar_inmueble"), "no escribe en una baja");
});

test("un inmueble sin tipo lo recibe; con tipo, no se toca", async () => {
  const sinTipo = crmSimulado({ Tipo: null });
  const r = await subirFicha(ficha({ tipo: "Piso" }), sinTipo.llamar);
  assert.equal(r.ok, true, JSON.stringify(r.noGuardados));
  assert.equal(sinTipo.inmueble.Tipo, "Pisos");

  const conTipo = crmSimulado({ Tipo: "Locales" });
  await subirFicha(ficha({ tipo: "Piso" }), conTipo.llamar);
  assert.equal(conTipo.inmueble.Tipo, "Locales", "no se pisa un tipo que ya está");
});

test("la vista previa no escribe nada", async () => {
  const crm = crmSimulado();
  const prep = await prepararSubida(ficha({ precio: "1.000" }), crm.llamar);
  assert.equal(prep.ok, true);
  assert.equal(prep.parametros.Precio, 1000);
  assert.ok(!crm.llamadas.some((l) => l.servicio === "actualizar_inmueble"));
});
