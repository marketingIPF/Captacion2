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

/* ── Campos que se ven aunque estén vacíos ─────────────────────────────── */

/* La etiqueta se saca del esquema en vez de escribirla: si algún día cambia el
   nombre del campo, estos tests siguen comprobando lo que importa. */
const ETIQUETA_PROSPECTO = SECCIONES.flatMap((s) => s.fields).find((f) => f.key === "prospecto").label;

const fichaBase = (data = {}) => ({
  agenteName: "Ana",
  fecha: "2026-09-01T10:00:00.000Z",
  propietarios: [],
  data: { operacion: "Venta", tipo: "Piso", direccion: "Calle Mayor", ...data },
});

test("el prospecto se ve en la ficha aunque no lo hayan rellenado", async () => {
  /* Lo pidió Julia: la fila desaparecía y no se distinguía de una captación
     que nadie había revisado. */
  const { bloquesFicha, SIN_RELLENAR } = await import("../src/lib/resumen.js");
  const filas = bloquesFicha(fichaBase()).flatMap((b) => b.filas);
  const prospecto = filas.find(([k]) => k === ETIQUETA_PROSPECTO);

  assert.ok(prospecto, "la fila del prospecto tiene que estar");
  assert.equal(prospecto[1], SIN_RELLENAR);
  assert.equal(prospecto[2], true, "va marcada como vacía, para pintarla distinta");
});

test("con prospecto se muestra el valor, sin marca", async () => {
  const { bloquesFicha } = await import("../src/lib/resumen.js");
  const filas = bloquesFicha(fichaBase({ prospecto: "4120" })).flatMap((b) => b.filas);
  assert.deepEqual(filas.find(([k]) => k === ETIQUETA_PROSPECTO), [ETIQUETA_PROSPECTO, "4120"]);
});

test("lo que se copia NO incluye las filas vacías", async () => {
  /* Es la razón de marcarlas: "No tiene" pegado en un campo del CRM sería un
     dato falso, y Julia copia sección por sección. */
  const { bloquesFicha, bloqueComoTexto, textoFicha, SIN_RELLENAR } = await import("../src/lib/resumen.js");
  const ficha = fichaBase();
  const bloque = bloquesFicha(ficha).find((b) => b.filas.some(([k]) => k === ETIQUETA_PROSPECTO));

  assert.ok(bloque, "el bloque del prospecto debería existir");
  assert.ok(!bloqueComoTexto(bloque).includes(SIN_RELLENAR), "la sección copiada lo incluye");
  assert.ok(!textoFicha(ficha).includes(SIN_RELLENAR), "la ficha completa copiada lo incluye");

  /* Y con valor sí se copia, que es lo que le sirve. */
  const conValor = fichaBase({ prospecto: "4120" });
  assert.ok(textoFicha(conValor).includes("4120"));
});

test("una sección que solo tendría filas vacías no se pinta", async () => {
  /* Un título de sección para decir que no hay nada debajo es peor que nada.
     La de identificación siempre tiene algo (operación, tipo), así que se
     comprueba que ninguna sección queda hecha solo de ausencias. */
  const { bloquesFicha } = await import("../src/lib/resumen.js");
  for (const b of bloquesFicha(fichaBase())) {
    assert.ok(
      b.filas.some(([, , vacia]) => !vacia),
      `la sección «${b.titulo}» solo tiene filas vacías`
    );
  }
});

/* ── La fecha se escribe con la precisión que se sabe ───────────────────── */

test("de una captación del móvil se dice la hora; de una tecleada, solo el día", async () => {
  /* Guardábamos las tecleadas al mediodía UTC y pintábamos esa hora: todas las
     que Julia añadió una mañana salían "a las 14:00", una hora que aún no
     había llegado. La hora no se sabe, así que no se enseña. */
  const { fechaDeFicha } = await import("../src/lib/format.js");
  const cuando = "2026-09-11T12:00:00.000Z";

  const delAgente = fechaDeFicha({ recibida: cuando, origen: "agente" });
  const deLaOficina = fechaDeFicha({ recibida: cuando, origen: "oficina" });

  assert.match(delAgente, /\d{2}:\d{2}/, "de una del móvil sí se sabe el minuto");
  assert.doesNotMatch(deLaOficina, /\d{2}:\d{2}/, "de una tecleada se está inventando una hora");
  assert.ok(deLaOficina.includes("sept"), `debería seguir diciendo el día: ${deLaOficina}`);
  assert.ok(delAgente.startsWith(deLaOficina), "y el día tiene que ser el mismo");
});

test("vale tanto para la ficha del panel como para la del móvil", async () => {
  /* Una trae `recibida` y la otra `fecha`. Confundirlas es lo que hacía que el
     texto copiado dijera "Invalid Date". */
  const { fechaDeFicha } = await import("../src/lib/format.js");
  assert.equal(
    fechaDeFicha({ recibida: "2026-09-11T09:30:00.000Z" }),
    fechaDeFicha({ fecha: "2026-09-11T09:30:00.000Z" })
  );
  assert.equal(fechaDeFicha({}), "", "sin fecha no se escribe nada raro");
});

test("el texto que copia la oficina no dice Invalid Date", async () => {
  const { textoFicha } = await import("../src/lib/resumen.js");
  /* La forma que devuelve el panel: `recibida`, no `fecha`. */
  const delPanel = {
    agenteName: "Mª Luisa Bellver",
    recibida: "2026-09-11T12:00:00.000Z",
    origen: "oficina",
    propietarios: [],
    data: { operacion: "Venta", tipo: "Piso", direccion: "Migdia 4", precio: "568000" },
  };
  const texto = textoFicha(delPanel);
  assert.doesNotMatch(texto, /Invalid Date/);
  assert.match(texto, /Fecha: \d{2} \w+ 2026/);
});
