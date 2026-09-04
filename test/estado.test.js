import { test } from "node:test";
import assert from "node:assert/strict";
import { FASES, CLAVES_FASE, faseDe, faseOPrimera } from "../src/lib/fases.js";
import { ESTADOS } from "../api/_ficha.js";

test("el servidor valida contra las mismas fases que se pintan", () => {
  assert.deepEqual(ESTADOS, CLAVES_FASE);
});

test("las fases están en el orden del proceso", () => {
  assert.deepEqual(CLAVES_FASE, ["nueva", "agendada_fotos", "pendiente", "publicada", "baja"]);
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
