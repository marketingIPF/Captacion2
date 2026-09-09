import { test } from "node:test";
import assert from "node:assert/strict";
import { unirHistorial } from "../src/lib/recuperar.js";

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
