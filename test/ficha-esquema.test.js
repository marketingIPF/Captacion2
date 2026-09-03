import { test } from "node:test";
import assert from "node:assert/strict";
import { revisarFicha, calcularProgreso, fichaVacia, camposAplicables } from "../src/lib/ficha.js";
import { SECCIONES } from "../src/data/secciones.js";

const base = () => ({
  ...fichaVacia({ id: "a1", name: "Ana Ruiz" }),
  propietarios: [{ nombre: "Luis Pérez", telefono: "612345678", dni: "", email: "" }],
  data: { operacion: "Venta", tipo: "Piso", direccion: "Calle Mayor", poblacion: "Valencia", precio: "250000" },
});

test("una ficha mínima completa se puede enviar", () => {
  assert.deepEqual(revisarFicha(base()), []);
});

test("faltan obligatorios → errores localizables por sección", () => {
  const f = base();
  f.data.direccion = "";
  const errs = revisarFicha(f);
  assert.equal(errs.length, 1);
  assert.equal(errs[0].sec, "ubic");
});

test("el precio mínimo no puede superar al solicitado", () => {
  const f = base();
  f.data.precioMin = "300000";
  assert.match(revisarFicha(f)[0].msg, /superar/);
});

test("los campos condicionales no aplican a un garaje", () => {
  const dist = SECCIONES.find((s) => s.id === "dist");
  const claves = (tipo) => camposAplicables(dist, { tipo }).map((c) => c.key);
  assert.ok(claves("Piso").includes("dormitorios"));
  assert.ok(!claves("Garaje").includes("dormitorios"));
  assert.ok(claves("Garaje").includes("plazas"));
});

test("el progreso solo cuenta campos aplicables", () => {
  const f = base();
  f.data.tipo = "Garaje";
  const p = calcularProgreso(f);
  assert.ok(p > 0 && p <= 100);
});

test("las unidades del esquema son unidades de verdad", () => {
  /* "nº" o "año" no son unidades: se mostraban detrás del dato y salía
     "4 nº" o "1950 año" en el panel. Para la pista del campo está `ph`. */
  const REALES = new Set(["m²", "m²/m²", "m", "€", "€/mes", "€/año", "plantas"]);
  const malas = [];
  for (const sec of SECCIONES) {
    for (const f of sec.fields) {
      if (f.unidad && !REALES.has(f.unidad)) malas.push(`${f.key}: "${f.unidad}"`);
    }
  }
  assert.deepEqual(malas, [], `unidades que no lo son: ${malas.join(", ")}`);
});

test("los contadores y el año se muestran sin sufijo", async () => {
  const { bloquesFicha } = await import("../src/lib/resumen.js");
  const ficha = {
    agenteName: "Ana",
    fecha: "2026-09-01T10:00:00.000Z",
    propietarios: [],
    data: {
      operacion: "Venta", tipo: "Piso", direccion: "Calle Mayor",
      dormitorios: "4", banos: "3", aseos: "1", anio: "1950",
      mConstruidos: "120", mUtiles: "98,5", comunidad: "62", precio: "250000",
    },
  };
  const filas = Object.fromEntries(bloquesFicha(ficha).flatMap((b) => b.filas));

  assert.equal(filas["Dormitorios"], "4", "no debe decir '4 nº'");
  assert.equal(filas["Baños"], "3");
  assert.equal(filas["Aseos"], "1");
  /* Sin unidad y sin separador de miles: el formato español no agrupa los
     números de cuatro cifras, así que un año se lee como un año. */
  assert.equal(filas["Año de construcción"], "1950");

  /* Y las unidades de verdad sí se muestran. */
  assert.equal(filas["M² construidos"], "120 m²");
  assert.equal(filas["M² útiles"], "98,5 m²");
  assert.equal(filas["Gastos de comunidad"], "62 €/mes");
});
