import { test } from "node:test";
import assert from "node:assert/strict";
import { unirHistorial } from "../src/lib/recuperar.js";
import { podarHistorial, MAX_HISTORIAL } from "../src/lib/storage.js";

const local = (id, extra = {}) => ({
  id, agenteId: "eva-valles", agenteName: "Eva Vallés",
  fecha: "2026-09-01T10:00:00.000Z",
  envio: { estado: "enviada" },
  data: { referencia: "#05613", direccion: "Calle Mayor" },
  propietarios: [{ nombre: "Ana" }],
  ...extra,
});

const remota = (id, extra = {}) => ({
  id, agenteId: "eva-valles", agenteName: "Eva Vallés",
  creada: "2026-09-01T09:00:00.000Z",
  fecha: "2026-09-01T10:00:00.000Z",
  fase: "agendada_fotos",
  envio: { estado: "enviada", envios: 1 },
  data: { referencia: "#05613", direccion: "Calle Mayor" },
  propietarios: [{ nombre: "Ana" }],
  ...extra,
});

test("un móvil vacío recupera todo lo que tiene la oficina", () => {
  /* El caso de Eva: envió la captación, la oficina la tiene, y su historial
     apareció vacío. */
  const r = unirHistorial([], [remota("a"), remota("b", { fecha: "2026-09-05T10:00:00.000Z" })]);
  assert.deepEqual(r.map((f) => f.id), ["a", "b"]);
  assert.equal(r[0].fase, "agendada_fotos");
});

test("una corrección sin enviar NO se pisa con lo de la oficina", () => {
  /* La regla que evita perder trabajo: el agente corrigió el precio sin
     cobertura y la cola aún no lo ha mandado. Si ganara la oficina, su
     corrección desaparecería justo antes de salir. */
  const sinEnviar = local("a", {
    envio: { estado: "pendiente" },
    data: { referencia: "#05613", direccion: "Calle Mayor", precio: "195000" },
  });
  const [f] = unirHistorial([sinEnviar], [remota("a", { data: { referencia: "#05613", direccion: "Calle Mayor", precio: "250000" } })]);

  assert.equal(f.data.precio, "195000", "se ha perdido la corrección del agente");
  assert.equal(f.envio.estado, "pendiente", "y sigue pendiente de enviar");
});

test("lo que la oficina tiene y el móvil daba por no enviado pasa a enviada", () => {
  /* Si la oficina la tiene, es que llegó: el móvil se enteró mal. Pero solo
     cuando NO está pendiente en la cola, que es el caso de arriba. */
  const rechazada = local("a", { envio: { estado: "rechazada", error: "algo" } });
  const [f] = unirHistorial([rechazada], [remota("a")]);
  assert.equal(f.envio.estado, "enviada");
  assert.equal(f.fase, "agendada_fotos");
});

test("lo que solo tiene el móvil se queda", () => {
  /* Fichas en cola o rechazadas que todavía no han llegado a la oficina. */
  const enCola = local("solo-movil", { envio: { estado: "pendiente" } });
  const r = unirHistorial([enCola], [remota("a")]);
  assert.deepEqual(r.map((f) => f.id).sort(), ["a", "solo-movil"]);
});

test("no se duplica nada y queda de más antigua a más reciente", () => {
  const r = unirHistorial(
    [local("b", { fecha: "2026-09-05T10:00:00.000Z" }), local("a")],
    [remota("a"), remota("c", { fecha: "2026-09-03T10:00:00.000Z" })]
  );
  assert.deepEqual(r.map((f) => f.id), ["a", "c", "b"]);
  assert.equal(new Set(r.map((f) => f.id)).size, r.length, "hay ids repetidos");
});

test("una lista vacía de la oficina no borra el historial del móvil", () => {
  /* Importa: si la respuesta llegara vacía por lo que sea, no puede llevarse
     por delante lo que el agente tiene. */
  const mios = [local("a"), local("b")];
  assert.deepEqual(unirHistorial(mios, []).map((f) => f.id), ["a", "b"]);
  assert.deepEqual(unirHistorial(mios, null).map((f) => f.id), ["a", "b"]);
});

/* ── El recorte del historial ──────────────────────────────────────────── */

const enviada = (n) => local(`e${n}`, { fecha: `2026-09-${String(n).padStart(2, "0")}T10:00:00.000Z` });

test("el historial se queda en las últimas 15", () => {
  const veinte = Array.from({ length: 20 }, (_, i) => enviada(i + 1));
  const r = podarHistorial(veinte);
  assert.equal(r.length, MAX_HISTORIAL);
  assert.equal(r[0].id, "e6", "se van las más antiguas");
  assert.equal(r.at(-1).id, "e20", "y se queda la última");
});

test("una ficha sin enviar NO se descarta por antigua", () => {
  /* Con el tope en 100 esto era casi imposible; con 15, un agente que haga una
     tanda sin cobertura habría perdido de vista la primera. Solo existe en su
     móvil hasta que la cola la manda. */
  const enCola = local("en-cola", { envio: { estado: "pendiente" }, fecha: "2026-09-01T08:00:00.000Z" });
  const lista = [enCola, ...Array.from({ length: 20 }, (_, i) => enviada(i + 1))];
  const r = podarHistorial(lista);

  assert.ok(r.some((f) => f.id === "en-cola"), "se ha tirado una ficha que no ha llegado a la oficina");
  assert.equal(r.filter((f) => f.envio.estado === "enviada").length, MAX_HISTORIAL, "y el tope se respeta con las que sí llegaron");
  assert.equal(r[0].id, "en-cola", "sin desordenar la lista");
});

test("una rechazada tampoco se descarta", () => {
  /* El agente tiene que poder verla para reintentarla. */
  const fallida = local("fallida", { envio: { estado: "rechazada", error: "algo" }, fecha: "2026-09-01T08:00:00.000Z" });
  const r = podarHistorial([fallida, ...Array.from({ length: 20 }, (_, i) => enviada(i + 1))]);
  assert.ok(r.some((f) => f.id === "fallida"));
});

test("con menos de 15 no se toca nada", () => {
  const tres = [enviada(1), enviada(2), enviada(3)];
  assert.deepEqual(podarHistorial(tres), tres);
});

test("recuperar de la oficina no desborda el historial", () => {
  /* La oficina manda como mucho 15, y el móvil puede tener alguna en cola que
     ella no conoce: el total puede pasar de 15 y eso está bien. */
  const enCola = local("en-cola", { envio: { estado: "pendiente" }, fecha: "2026-09-30T10:00:00.000Z" });
  const oficina = Array.from({ length: 15 }, (_, i) => remota(`o${i}`, { fecha: `2026-09-${String(i + 1).padStart(2, "0")}T10:00:00.000Z` }));
  const r = podarHistorial(unirHistorial([enCola], oficina));

  assert.equal(r.filter((f) => f.envio.estado === "enviada").length, 15);
  assert.ok(r.some((f) => f.id === "en-cola"));
});
