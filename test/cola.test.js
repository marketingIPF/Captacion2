import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

/* localStorage mínimo: cola.js lo usa a través de lib/storage.js. */
const almacen = new Map();
globalThis.localStorage = {
  getItem: (k) => (almacen.has(k) ? almacen.get(k) : null),
  setItem: (k, v) => almacen.set(k, String(v)),
  removeItem: (k) => almacen.delete(k),
};

const { enviarAlServidor, encolar, desencolar, pendientes, procesarCola, leerCola } =
  await import("../src/lib/cola.js");

const respuesta = (status, cuerpo) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => cuerpo,
});

const ficha = (id) => ({ id, data: { direccion: "Calle Test" }, propietarios: [] });

beforeEach(() => almacen.clear());

test("un 503 del servidor NO se confunde con falta de conexión", async () => {
  globalThis.fetch = async () => respuesta(503, { error: "DATABASE_URL no está configurada" });
  const r = await enviarAlServidor(ficha("a"), "pin");
  assert.equal(r.ok, false);
  assert.equal(r.tipo, "servidor", "es un fallo del servidor, no del móvil");
  assert.equal(r.estado, 503);
  assert.match(r.error, /DATABASE_URL/);
});

test("distingue una variable sin configurar de una base de datos caída", async () => {
  globalThis.fetch = async () => respuesta(503, {
    error: "El servidor no está bien configurado. Avisa a la oficina: la ficha no se perderá.",
    causa: "configuracion",
  });
  const r = await enviarAlServidor(ficha("cfg"), "pin");
  assert.equal(r.tipo, "servidor");
  assert.equal(r.causa, "configuracion", "la categoría llega al cliente para poder explicarla");
  assert.match(r.error, /Avisa a la oficina/);
  assert.ok(!/DATABASE_URL/.test(r.error), "el error interno no debe filtrarse al agente");
});

test("un fallo de red sí es offline", async () => {
  globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
  const r = await enviarAlServidor(ficha("b"), "pin");
  assert.equal(r.tipo, "offline");
});

test("400 y 401 se marcan como rechazadas y no se reintentan", async () => {
  for (const status of [400, 401]) {
    globalThis.fetch = async () => respuesta(status, { error: "mal" });
    const r = await enviarAlServidor(ficha("c"), "pin");
    assert.equal(r.tipo, "rechazada", `${status} debería ser rechazada`);
  }
});

test("un envío correcto devuelve ok", async () => {
  globalThis.fetch = async () => respuesta(200, { ok: true, recibida: "2026-09-03T00:00:00Z" });
  const r = await enviarAlServidor(ficha("d"), "pin");
  assert.equal(r.ok, true);
  assert.equal(r.recibida, "2026-09-03T00:00:00Z");
});

test("encolar la misma ficha dos veces no la duplica", () => {
  encolar(ficha("x"));
  encolar(ficha("x"));
  assert.equal(pendientes(), 1);
  encolar(ficha("y"));
  assert.equal(pendientes(), 2);
  desencolar("x");
  assert.equal(pendientes(), 1);
});

test("procesar la cola vacía la que se envía y conserva la que falla", async () => {
  encolar(ficha("1"));
  encolar(ficha("2"));
  let n = 0;
  globalThis.fetch = async () => {
    n += 1;
    return n === 1 ? respuesta(200, { ok: true }) : respuesta(503, { error: "caída" });
  };
  const r = await procesarCola("pin");
  assert.equal(r.enviadas, 1);
  assert.equal(r.fallidas, 1);
  assert.equal(r.motivo, "servidor", "debe poder explicar por qué falló");
  assert.equal(leerCola()[0].intentos, 1, "cuenta el intento para no reintentar sin fin");
});

test("una ficha rechazada sale de la cola: reintentarla no arreglaría nada", async () => {
  encolar(ficha("mala"));
  globalThis.fetch = async () => respuesta(400, { error: "Falta la dirección" });
  const r = await procesarCola("pin");
  assert.equal(r.rechazadas, 1);
  assert.equal(pendientes(), 0);
});

test("sin PIN no se intenta nada, para no vaciar la cola por error", async () => {
  encolar(ficha("z"));
  const r = await procesarCola("");
  assert.equal(r.enviadas, 0);
  assert.equal(pendientes(), 1);
});
