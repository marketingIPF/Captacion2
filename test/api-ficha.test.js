import { test } from "node:test";
import assert from "node:assert/strict";
import { fichaAFila, filaAResumen, aNumero } from "../api/_ficha.js";
import { pinValido, limitado, anotarFallo, reiniciarLimite, leerBody } from "../api/_auth.js";

const valida = () => ({
  id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
  creada: "2026-09-01T10:00:00.000Z",
  agenteId: "a1",
  agenteName: "Ana Ruiz",
  propietarios: [{ nombre: "Luis Pérez", telefono: "612345678" }],
  data: { tipo: "Piso", direccion: "Calle Mayor", numero: "3", poblacion: "Valencia", precio: "250.000", operacion: "Venta" },
});

test("convierte una ficha válida en fila, con el precio como número", () => {
  const { ok, fila } = fichaAFila(valida());
  assert.equal(ok, true);
  assert.equal(fila.precio, 250000);
  assert.equal(fila.direccion, "Calle Mayor");
  assert.equal(fila.agente_nombre, "Ana Ruiz");
});

test("rechaza identificadores que no son UUID", () => {
  const f = { ...valida(), id: "F123456; drop table fichas" };
  assert.equal(fichaAFila(f).ok, false);
});

test("rechaza fichas sin lo imprescindible", () => {
  for (const quitar of ["tipo", "direccion"]) {
    const f = valida();
    delete f.data[quitar];
    assert.equal(fichaAFila(f).ok, false, `debería rechazar sin ${quitar}`);
  }
  const sinProp = valida();
  sinProp.propietarios = [{ nombre: "  " }];
  assert.equal(fichaAFila(sinProp).ok, false);
});

test("rechaza fichas desproporcionadas", () => {
  const f = valida();
  f.data.notasInternas = "x".repeat(300_000);
  assert.match(fichaAFila(f).error, /demasiado grande/);
});

test("números en formato español", () => {
  assert.equal(aNumero("250.000"), 250000);
  assert.equal(aNumero("85,5"), 85.5);
  assert.equal(aNumero(""), null);
  assert.equal(aNumero("no soy un número"), null);
});

test("el resumen del listado no expone datos del propietario", () => {
  const { fila } = fichaAFila(valida());
  const r = filaAResumen({ ...fila, recibida_en: new Date(), estado: "nueva" });
  assert.equal(JSON.stringify(r).includes("Luis"), false);
  assert.equal(JSON.stringify(r).includes("612345678"), false);
  assert.equal(r.direccion, "Calle Mayor 3");
});

test("el PIN se compara sin filtrar longitud ni prefijo", () => {
  assert.equal(pinValido("secreto", "secreto"), true);
  assert.equal(pinValido("secret", "secreto"), false);
  assert.equal(pinValido("secretoo", "secreto"), false);
  assert.equal(pinValido("", ""), false);
  assert.equal(pinValido(undefined, "secreto"), false);
});

test("el limitador bloquea tras varios fallos y aísla por IP", () => {
  reiniciarLimite();
  const ip = "9.9.9.9";
  for (let i = 0; i < 8; i++) { limitado(ip); anotarFallo(ip); }
  assert.equal(limitado(ip), true);
  assert.equal(limitado("8.8.8.8"), false, "otra IP no debe verse afectada");
});

test("leerBody acepta objeto, texto y basura", () => {
  assert.deepEqual(leerBody({ body: { pin: "x" } }), { pin: "x" });
  assert.deepEqual(leerBody({ body: '{"pin":"x"}' }), { pin: "x" });
  assert.deepEqual(leerBody({ body: "no es json" }), {});
  assert.deepEqual(leerBody({}), {});
});
