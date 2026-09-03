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
