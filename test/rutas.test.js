import { test } from "node:test";
import assert from "node:assert/strict";

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
