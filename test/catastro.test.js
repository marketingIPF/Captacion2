import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  interpretar, camposDesde, tipoDeRef, limpiarRef, capitalizar, etiquetaUnidad,
} from "../src/lib/catastro.js";
import { validarRefCatastral } from "../src/lib/validacion.js";

/* Respuestas reales del Catastro, grabadas: los tests no tocan la red. */
const fixture = (n) => JSON.parse(readFileSync(new URL(`./fixtures/${n}.json`, import.meta.url)));

test("una referencia de 20 caracteres da un solo inmueble", () => {
  const r = interpretar(fixture("catastro-6121104YJ2762A0001WJ"));
  assert.equal(r.ok, true);
  assert.equal(r.unidades.length, 1);
  const u = r.unidades[0];
  assert.equal(u.direccion, "Calle Colon");
  assert.equal(u.numero, "26");
  assert.equal(u.cp, "46004");
  assert.equal(u.poblacion, "Valencia");
  assert.equal(u.mConstruidos, "559");
  assert.equal(u.anio, "1940");
  assert.equal(u.ref, "6121104YJ2762A0001WJ");
});

test("una referencia de 14 caracteres da todas las unidades de la parcela", () => {
  const r = interpretar(fixture("catastro-6121104YJ2762A"));
  assert.equal(r.ok, true);
  assert.ok(r.unidades.length > 1, `esperaba varias, hay ${r.unidades.length}`);
  /* Cada unidad debe traer su referencia completa de 20 caracteres. */
  for (const u of r.unidades) {
    assert.equal(u.ref.length, 20, `ref rara: ${u.ref}`);
  }
  /* Y no puede haber dos con la misma, o React duplicaría claves. */
  assert.equal(new Set(r.unidades.map((u) => u.ref)).size, r.unidades.length);
});

test("un error del Catastro se traduce a un aviso legible", () => {
  const r = interpretar(fixture("catastro-error"));
  assert.equal(r.ok, false);
  assert.equal(r.codigo, "4");
  assert.match(r.error, /^La referencia/, "debe quedar capitalizado, no en mayúsculas");
  assert.ok(!/[A-Z]{4}/.test(r.error), `sigue gritando: ${r.error}`);
});

test("respuestas inesperadas no rompen nada", () => {
  for (const basura of [null, {}, { consulta_dnprcResult: {} }, { otra: 1 }]) {
    const r = interpretar(basura);
    assert.equal(r.ok, false);
    assert.ok(r.error);
  }
});

test("solo se aceptan referencias de 14 o 20 caracteres", () => {
  assert.equal(tipoDeRef("6121104YJ2762A"), "parcela");
  assert.equal(tipoDeRef("6121104YJ2762A0001WJ"), "unidad");
  assert.equal(tipoDeRef("6121104 YJ2762A"), "parcela", "tolera espacios");
  assert.equal(tipoDeRef("123"), null);
  assert.equal(tipoDeRef("6121104YJ2762A0001W"), null, "19 caracteres no vale");
  assert.equal(tipoDeRef(""), null);
});

test("el validador del formulario coincide con lo que acepta el servicio", () => {
  assert.equal(validarRefCatastral("6121104YJ2762A"), "");
  assert.equal(validarRefCatastral("6121104YJ2762A0001WJ"), "");
  assert.equal(validarRefCatastral(""), "", "vacío es válido: el campo es opcional");
  assert.match(validarRefCatastral("6121104"), /14 caracteres/);
  assert.match(validarRefCatastral("6121104YJ2762A!!!!!!"), /letras y números/);
});

test("los campos vacíos no borran lo que ya había escrito el agente", () => {
  const campos = camposDesde({
    ref: "X", direccion: "Calle Falsa", numero: "", planta: "", puerta: "",
    escalera: "", cp: "46001", poblacion: "", provincia: "", mConstruidos: "", anio: "",
  });
  assert.deepEqual(Object.keys(campos).sort(), ["cp", "direccion", "refCatastral"]);
});

test("el tipo de inmueble solo se sugiere cuando el uso es inequívoco", () => {
  const uso = (luso) => interpretar({
    consulta_dnprcResult: { bico: { bi: { debi: { luso } } } },
  }).unidades[0].tipoSugerido;
  assert.equal(uso("Comercial"), "Local");
  assert.equal(uso("Almacen-Estacionamiento"), "Garaje");
  assert.equal(uso("Suelo sin edif."), "Terreno");
  assert.equal(uso("Residencial"), null, "no distingue piso de ático ni chalet");
});

test("capitalizar respeta las partículas y los guiones", () => {
  assert.equal(capitalizar("AVENIDA DE LOS NARANJOS"), "Avenida de los Naranjos");
  assert.equal(capitalizar("SANT-JOAN"), "Sant-Joan");
  assert.equal(capitalizar("LA POBLA DE FARNALS"), "La Pobla de Farnals");
  assert.equal(capitalizar(""), "");
});

test("la etiqueta de cada unidad es legible aunque falten datos", () => {
  const a = etiquetaUnidad({ escalera: "1", planta: "3", puerta: "B", uso: "Residencial", mConstruidos: "94" });
  assert.equal(a.sitio, "Esc. 1 · Planta 3 · Puerta B");
  assert.equal(a.datos, "Residencial · 94 m²");
  const b = etiquetaUnidad({});
  assert.equal(b.sitio, "Sin desglose");
});

test("el segundo número de vía solo se añade si es real", () => {
  const num = (pnp, snp) => interpretar({
    consulta_dnprcResult: { bico: { bi: {
      dt: { locs: { lous: { lourb: { dir: { pnp, snp } } } } },
    } } },
  }).unidades[0].numero;
  assert.equal(num("26", "0"), "26", "el snp a cero no debe colarse");
  assert.equal(num("26", ""), "26");
  assert.equal(num("26", undefined), "26");
  assert.equal(num("26", "28"), "26-28", "un segundo número real sí vale");
  assert.equal(num("26", "26"), "26", "repetido no aporta nada");
});

test("limpiarRef normaliza lo que teclea el agente", () => {
  assert.equal(limpiarRef(" 6121104-yj2762a "), "6121104YJ2762A");
});

test("la dirección se compone en una línea, como la piden los portales", async () => {
  const { direccionCompleta, cifrasClave, bloqueComoTexto } = await import("../src/lib/resumen.js");

  const ficha = (data) => ({ data, propietarios: [] });
  assert.equal(
    direccionCompleta(ficha({ direccion: "Calle Colón", numero: "26", bloque: "1", planta: "2", puerta: "02", cp: "46004", poblacion: "Valencia" })),
    "Calle Colón 26, Esc. 1, Pl. 2, Pta. 02 · 46004 Valencia"
  );
  assert.equal(
    direccionCompleta(ficha({ direccion: "Camí de Vera", numero: "88", poblacion: "Alboraya" })),
    "Camí de Vera 88 · Alboraya",
    "sin interior ni CP no deja comas ni puntos sueltos"
  );
  assert.equal(direccionCompleta(ficha({})), "", "una ficha vacía no da basura");

  /* Las cifras clave solo incluyen lo que existe. */
  const cifras = cifrasClave(ficha({ mConstruidos: "321", dormitorios: "4", anio: "1940" }));
  assert.deepEqual(cifras.map((c) => c.etiqueta), ["M² construidos", "Dormitorios", "Año"]);
  assert.equal(cifras[0].unidad, "m²");
  assert.equal(cifrasClave(ficha({})).length, 0);

  assert.equal(
    bloqueComoTexto({ titulo: "X", filas: [["Precio", "385.000"], ["Año", "1940"]] }),
    "Precio: 385.000\nAño: 1940"
  );
});

test("una captación se llama por su referencia, y por la calle solo si no la tiene", async () => {
  const { nombreDeFicha, subtituloDeFicha, tituloFicha } = await import("../src/lib/resumen.js");

  /* Ficha completa, como la del detalle o el historial del agente. */
  const con = { data: { referencia: "#05619", direccion: "Calle Colón", numero: "26", tipo: "Piso" } };
  assert.equal(nombreDeFicha(con), "#05619");
  assert.equal(subtituloDeFicha(con), "Calle Colón 26", "la dirección pasa debajo");
  assert.equal(tituloFicha(con), "Piso · #05619");

  const sin = { data: { direccion: "Calle Colón", numero: "26", tipo: "Piso" } };
  assert.equal(nombreDeFicha(sin), "Calle Colón 26");
  assert.equal(subtituloDeFicha(sin), null, "no se repite la dirección debajo de sí misma");

  /* Fila reducida del listado, que trae los campos sueltos. */
  assert.equal(nombreDeFicha({ referencia: "#05620", direccion: "Camí de Vera 88" }), "#05620");
  assert.equal(subtituloDeFicha({ referencia: "#05620", direccion: "Camí de Vera 88" }), "Camí de Vera 88");
  assert.equal(nombreDeFicha({ direccion: "Camí de Vera 88" }), "Camí de Vera 88");

  /* Sin nada, algo hay que poner. */
  assert.equal(nombreDeFicha({ data: {} }), "Sin referencia");
  assert.equal(nombreDeFicha({ referencia: "   " }), "Sin referencia", "una referencia en blanco no cuenta");
});
