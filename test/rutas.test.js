import { test } from "node:test";
import assert from "node:assert/strict";
import { nombreCorto } from "../src/lib/format.js";

/* Misma expresión que usa src/main.jsx para decidir qué app se monta. */
const esAdmin = (ruta) => ruta.replace(/\/+$/, "").toLowerCase() === "/admin";

test("solo /admin abre el panel", () => {
  for (const r of ["/admin", "/admin/", "/admin//", "/Admin", "/ADMIN/"]) {
    assert.equal(esAdmin(r), true, `${r} debería abrir el panel`);
  }
  for (const r of ["/", "", "/administracion", "/admin/fichas", "/x/admin", "/adminx"]) {
    assert.equal(esAdmin(r), false, `${r} NO debería abrir el panel`);
  }
});

test("el nombre de quien teclea la captación se acorta para caber", () => {
  /* La sesión trae el nombre de Google si lo hay y, si no, el correo entero.
     En la columna del listado no cabe ninguno de los dos completos. */
  assert.equal(nombreCorto("Julia Pérez Martín"), "Julia");
  assert.equal(nombreCorto("julia@inmobiliariapalanca.com"), "Julia");
  assert.equal(nombreCorto("info@inmobiliariapalanca.com"), "Info");
  assert.equal(nombreCorto("marketing@inmobiliariapalanca.com"), "Marketing");
  assert.equal(nombreCorto("maria.jose@rk.com"), "Maria", "un correo con punto no es una sola palabra");
});

test("sin nombre no se inventa nada", () => {
  /* Las fichas creadas antes de guardar esta columna no lo tienen: quien pinte
     decide qué decir, en vez de recibir un 'undefined'. */
  for (const v of ["", null, undefined, "   ", "@raro"]) {
    assert.equal(nombreCorto(v), "", `«${v}» debería dar vacío`);
  }
});
