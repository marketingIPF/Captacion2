import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FASES, CLAVES_FASE, faseDe, faseOPrimera } from "../src/lib/fases.js";
import { ESTADOS } from "../api/_ficha.js";
import { repartir } from "../api/estado.js";

test("el servidor valida contra las mismas fases que se pintan", () => {
  assert.deepEqual(ESTADOS, CLAVES_FASE);
});

test("las fases están en el orden del proceso", () => {
  assert.deepEqual(CLAVES_FASE, [
    "nueva",
    "agendada_fotos",
    "pendiente",
    "publicada",
    "reservado",
    "vendido",
    "alquilado",
    /* La salida, no la última etapa: una captación que no vale. Va al final
       para que en el filtro del panel quede fuera del recorrido normal. */
    "baja",
  ]);
});

test("una fase desconocida no rompe nada", () => {
  assert.equal(faseDe("inventada"), null, "quien pinte decide qué hacer");
  assert.equal(faseDe(undefined), null);
  assert.equal(faseDe(null), null);
  assert.equal(faseOPrimera("inventada").key, "nueva", "en el panel siempre hay que pintar algo");
});

test("cada fase trae las variantes de color que necesita cada sitio", () => {
  for (const f of FASES) {
    for (const tono of ["color", "fuerte", "claro", "fondo"]) {
      assert.match(f[tono], /^#[0-9a-f]{6}$/i, `${f.key} sin ${tono}`);
    }
    assert.ok(f.label.length > 2, `${f.key} sin etiqueta legible`);
  }
  const tonos = new Set(FASES.map((f) => f.color));
  assert.equal(tonos.size, FASES.length, "hay fases con el mismo color");
});

test("el texto blanco sobre el tono fuerte se lee (WCAG AA)", () => {
  /* Es la comprobación que motivó tener un tono 'fuerte': el naranja de marca
     sobre blanco daba 3,4:1 y no pasaba. */
  const luminancia = (hex) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const lin = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  };
  for (const f of FASES) {
    const contraste = 1.05 / (luminancia(f.fuerte) + 0.05);
    assert.ok(contraste >= 4.5, `${f.key}: ${contraste.toFixed(2)}:1 con blanco encima, hace falta 4.5`);
  }
});

test("el móvil solo recibe noticias de las fichas de su agente", () => {
  /* El PIN es el mismo para todo el equipo: sin filtrar por agente, cualquiera
     podría ir siguiendo las captaciones de un compañero desde su móvil. */
  const ids = ["mia", "de-otro", "mia-borrada", "de-otro-borrada", "nunca-llego"];
  const filas = [
    { id: "mia", estado: "publicada", agente_id: "eva", eliminada_en: null },
    { id: "de-otro", estado: "pendiente", agente_id: "fede", eliminada_en: null },
    { id: "mia-borrada", estado: "nueva", agente_id: "eva", eliminada_en: "2026-09-04" },
    { id: "de-otro-borrada", estado: "nueva", agente_id: "fede", eliminada_en: "2026-09-04" },
  ];

  const r = repartir(ids, filas, "eva");
  assert.deepEqual(r.estados, { mia: "publicada" }, "la fase de otro no se cuenta");
  assert.deepEqual(
    r.eliminadas.sort(),
    ["mia-borrada", "nunca-llego"],
    "de otro no se avisa; borrarla del historial ajeno sería peor que callarse"
  );
});

test("sin agente indicado se responde por todas: un móvil viejo no se queda a medias", () => {
  const filas = [{ id: "a", estado: "nueva", agente_id: "eva", eliminada_en: null }];
  const r = repartir(["a", "b"], filas, "");
  assert.deepEqual(r.estados, { a: "nueva" });
  assert.deepEqual(r.eliminadas, ["b"]);
});


/* Las dos comprobaciones que faltaban, y que habrían avisado antes:
   la etiqueta del panel no llegaba al contraste mínimo en NINGUNA fase. */
const luminancia = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
};
const contraste = (a, b) => {
  const [alta, baja] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (alta + 0.05) / (baja + 0.05);
};

test("la etiqueta de cada fase se lee sobre su propio tinte (WCAG AA)", () => {
  for (const f of FASES) {
    const r = contraste(f.fuerte, f.fondo);
    assert.ok(r >= 4.5, `${f.key}: ${r.toFixed(2)}:1 — el texto de la etiqueta no se lee`);
  }
});

test("index.css y fases.js dicen lo mismo", () => {
  /* Los tonos están repetidos en el CSS porque el cambio entre claro y oscuro
     lo hace el navegador. Es la única copia que no he sabido evitar, así que
     al menos no puede separarse sin que esto falle. */
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
  /* Los dos bloques que declaran las variables, en el orden del archivo: el
     primero es el modo claro y el segundo el oscuro. Se buscan por su
     contenido y no partiendo por la media query, porque el archivo tiene
     varias. */
  const bloques = [...css.matchAll(/:root\s*\{([^}]*--estado-[^}]*)\}/g)].map((m) => m[1]);
  assert.equal(bloques.length, 2, `se esperaban 2 bloques con --estado-*, hay ${bloques.length}`);
  const [claro, oscuro] = bloques;

  for (const f of FASES) {
    assert.ok(
      claro.includes(`--estado-${f.key}: ${f.fuerte};`),
      `falta o no cuadra --estado-${f.key}: ${f.fuerte} en el modo claro`
    );
    assert.ok(
      oscuro.includes(`--estado-${f.key}: ${f.claro};`),
      `falta o no cuadra --estado-${f.key}: ${f.claro} en el modo oscuro`
    );
  }

  /* Y al revés: ninguna variable de sobra de una fase que ya no existe. */
  const declaradas = [...css.matchAll(/--estado-([a-z_]+):/g)].map((m) => m[1]);
  for (const clave of new Set(declaradas)) {
    assert.ok(CLAVES_FASE.includes(clave), `--estado-${clave} sobra: esa fase no existe`);
  }
});


test("la base de datos acepta exactamente las fases que existen", () => {
  /* Si el CHECK se separa de FASES, la oficina mueve una captación a una fase
     legítima y Postgres la rechaza: un 500 sin explicación en el panel. */
  const esquema = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");
  const m = esquema.match(/check \(estado in \(([^)]*)\)\)/);
  assert.ok(m, "no se ha encontrado el CHECK de estado en db/schema.sql");
  const enEsquema = [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
  assert.deepEqual(
    enEsquema.slice().sort(),
    CLAVES_FASE.slice().sort(),
    "db/schema.sql y fases.js no cuadran: falta una migración o falta una fase"
  );
});

test("una captación tecleada hoy se guarda a la hora real, no al mediodía", async () => {
  /* Con el mediodía, una tecleada a las 10:00 quedaba marcada a las 14:00 y se
     colaba por encima de las que llegaban de verdad esa mañana: el listado
     enterraba las nuevas bajo las de la oficina. */
  const { fechaSuelta } = await import("../api/admin.js");
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
  const t = Date.parse(fechaSuelta(hoy));

  assert.ok(Math.abs(Date.now() - t) < 5000, "debería ser ahora mismo");
  assert.ok(t <= Date.now(), "y nunca una hora que no ha llegado");
});

test("con fecha pasada se mantiene el día, sin inventar hora", async () => {
  const { fechaSuelta } = await import("../api/admin.js");
  const r = fechaSuelta("2019-04-23");
  assert.equal(new Date(r).toLocaleDateString("es-ES", { timeZone: "Europe/Madrid" }), "23/4/2019");
  assert.ok(Date.parse(r) < Date.now(), "un día que ya pasó no puede adelantar a nada");
});

test("una fecha ilegible no se cuela", async () => {
  const { fechaSuelta } = await import("../api/admin.js");
  for (const v of ["", "   ", "ayer", null, undefined, 20190423]) {
    assert.equal(fechaSuelta(v), null, `«${v}» debería rechazarse`);
  }
});
