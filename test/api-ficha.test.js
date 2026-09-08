import { test } from "node:test";
import assert from "node:assert/strict";
import { fichaAFila, fichaAFilaDeOficina, filaAResumen, aNumero, AGENTE_OFICINA } from "../api/_ficha.js";
import { pinValido, limitado, anotarFallo, reiniciarLimite, leerBody } from "../api/_auth.js";

const ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

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

/* ── Captación tecleada desde la oficina ───────────────────────────────── */

test("la oficina puede guardar una captación con casi nada", () => {
  /* Es el caso que pidió Julia: las de antes de la app. De algunas no queda
     ni el propietario ni el tipo. */
  const { ok, fila } = fichaAFilaDeOficina({ id: ID, data: {} });
  assert.equal(ok, true);
  assert.equal(fila.direccion, null);
  assert.equal(fila.tipo, null);
  assert.deepEqual(fila.propietarios, []);
});

test("sin agente queda a nombre de la oficina, no a nulo", () => {
  /* agente_id y agente_nombre no admiten nulo en la base de datos: sin este
     relleno, guardar sin elegir agente reventaría con un error de Postgres. */
  const { fila } = fichaAFilaDeOficina({ id: ID, data: {} });
  assert.equal(fila.agente_id, AGENTE_OFICINA.id);
  assert.equal(fila.agente_nombre, AGENTE_OFICINA.name);
  assert.ok(fila.agente_id && fila.agente_nombre, "la base de datos los exige");
});

test("si la oficina dice de quién era, se respeta", () => {
  const { fila } = fichaAFilaDeOficina({
    id: ID,
    data: { direccion: "Calle Colón 4" },
    agenteId: "eva-valles",
    agenteName: "Eva Vallés",
  });
  assert.equal(fila.agente_id, "eva-valles");
  assert.equal(fila.agente_nombre, "Eva Vallés");
});

test("los propietarios vacíos no se guardan", () => {
  /* El formulario arranca con una fila de propietario en blanco. Guardarla
     dejaría un propietario fantasma en cada ficha antigua. */
  const { fila } = fichaAFilaDeOficina({
    id: ID,
    data: {},
    propietarios: [
      { nombre: "", telefono: "", dni: "", email: "" },
      { nombre: "Ana", telefono: "", dni: "", email: "" },
    ],
  });
  assert.equal(fila.propietarios.length, 1);
  assert.equal(fila.propietarios[0].nombre, "Ana");
});

test("un identificador inválido sí se rechaza", () => {
  /* Lo único que se sigue exigiendo: sin id no hay fila que insertar. */
  assert.equal(fichaAFilaDeOficina({ id: "no-es-uuid", data: {} }).ok, false);
  assert.equal(fichaAFilaDeOficina(null).ok, false);
});

test("la entrada del agente NO se relaja", () => {
  /* La razón de tener dos funciones: que aflojar una no afloje la otra. Si
     esto empieza a pasar, es que alguien las ha unificado con una bandera. */
  const aMedias = { id: ID, data: {}, agenteId: "eva-valles", agenteName: "Eva Vallés" };
  assert.equal(fichaAFila(aMedias).ok, false, "sin tipo ni dirección no debería colar");
  assert.equal(fichaAFila({ ...aMedias, data: { tipo: "Piso", direccion: "X" } }).ok, false, "sigue faltando el propietario");
});

test("las dos rutas traducen los campos igual", () => {
  /* Comparten el mapeo a propósito: si se separaran, la misma ficha guardaría
     un precio distinto según por dónde entrara. */
  const ficha = {
    id: ID,
    agenteId: "eva-valles",
    agenteName: "Eva Vallés",
    propietarios: [{ nombre: "Ana" }],
    data: { tipo: "Piso", direccion: "Calle Colón", numero: "4", precio: "250.000", cp: "46011", operacion: "Venta" },
  };
  const a = fichaAFila(ficha).fila;
  const b = fichaAFilaDeOficina(ficha).fila;
  for (const c of ["agente_id", "tipo", "direccion", "numero", "precio", "cp", "operacion", "referencia"]) {
    assert.deepEqual(b[c], a[c], `el campo ${c} se traduce distinto según la ruta`);
  }
});
