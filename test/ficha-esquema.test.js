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

test("de una tecleada HOY se dice la hora a la que se tecleó", async () => {
  /* Es lo que pidió Roberto: si Julia la mete esta mañana, ver a qué hora la
     metió. Se sabe con exactitud, así que se dice. */
  const { fechaDeFicha } = await import("../src/lib/format.js");
  const r = fechaDeFicha({
    origen: "oficina",
    recibida: "2026-09-11T12:00:00.000Z",  // el día que ella eligió
    creada: "2026-09-11T08:45:00.000Z",    // cuando la tecleó de verdad
  });
  assert.match(r, /\d{2}:\d{2}/, "hoy sí se sabe la hora");
  assert.ok(!r.includes("14:00"), `no puede salir el mediodía inventado: ${r}`);
});

test("de una tecleada con fecha ANTIGUA solo se dice el día", async () => {
  /* De una captación de 2019 no se sabe a qué hora fue; la hora a la que Julia
     la teclea hoy no es la hora de aquella captación. */
  const { fechaDeFicha } = await import("../src/lib/format.js");
  const r = fechaDeFicha({
    origen: "oficina",
    recibida: "2019-04-23T12:00:00.000Z",
    creada: "2026-09-11T08:45:00.000Z",
  });
  assert.doesNotMatch(r, /\d{2}:\d{2}/);
  assert.ok(r.includes("2019"), `tiene que ser la fecha de la captación: ${r}`);
});

test("de una captación del móvil se dice la hora; de una tecleada sin más datos, solo el día", async () => {
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

/* ── Campos que admiten varias opciones ────────────────────────────────── */

const defDe = (clave) => SECCIONES.flatMap((s) => s.fields).find((f) => f.key === clave);

test("los materiales y acabados admiten varias opciones", async () => {
  /* Lo pidió el equipo: una vivienda puede tener madera Y aluminio, o gres en
     la cocina y tarima en los dormitorios. */
  for (const clave of ["ventanaMat", "ventanaApertura", "puertas", "suelos", "acs", "clima", "calefaccion", "paredes", "fachada", "orientacion"]) {
    assert.equal(defDe(clave)?.kind, "chips", `${clave} debería admitir varias`);
  }
});

test("lo que por naturaleza es una sola cosa sigue siéndolo", () => {
  /* Una operación no es venta Y alquiler, ni una cocina independiente Y
     americana. Marcar todo como múltiple invita a fichas incoherentes. */
  for (const clave of ["operacion", "cee", "ceeLetra", "ocupacion", "autorizacion", "exclusiva", "cocinaTipo", "fuegos", "estado", "ascensor", "vpo"]) {
    assert.equal(defDe(clave)?.kind, "seg", `${clave} no debería admitir varias`);
  }
});

test('las opciones "No tiene" están marcadas como excluyentes', () => {
  /* Sin esto se podría guardar "Climatización: A/A Splits, No tiene". */
  for (const clave of ["clima", "calefaccion"]) {
    const def = defDe(clave);
    assert.ok(def.options.includes("No tiene"), `${clave} ya no tiene esa opción`);
    assert.deepEqual(def.exclusivas, ["No tiene"], `${clave} sin marcar la excluyente`);
  }
});

test("una ficha antigua con un solo valor se sigue leyendo", async () => {
  /* Las guardadas antes del cambio tienen ahí un texto, no una lista. Tienen
     que seguir viéndose igual en el panel y en el papel. */
  const { bloquesFicha } = await import("../src/lib/resumen.js");
  const filas = bloquesFicha({
    agenteName: "Ana",
    fecha: "2026-09-01T10:00:00.000Z",
    propietarios: [],
    data: { operacion: "Venta", tipo: "Piso", direccion: "Calle Mayor", suelos: "Gres", ventanaMat: "Aluminio" },
  }).flatMap((b) => b.filas);

  assert.equal(filas.find(([k]) => k === "Suelos")?.[1], "Gres");
  assert.equal(filas.find(([k]) => k === "Ventanas — material")?.[1], "Aluminio");
});

test("una ficha nueva con varias se escribe separada por comas", async () => {
  const { bloquesFicha } = await import("../src/lib/resumen.js");
  const filas = bloquesFicha({
    agenteName: "Ana",
    fecha: "2026-09-01T10:00:00.000Z",
    propietarios: [],
    data: { operacion: "Venta", tipo: "Piso", direccion: "Calle Mayor", ventanaMat: ["Madera", "Aluminio"] },
  }).flatMap((b) => b.filas);

  assert.equal(filas.find(([k]) => k === "Ventanas — material")?.[1], "Madera, Aluminio");
});
