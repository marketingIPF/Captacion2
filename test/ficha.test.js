import { test } from "node:test";
import assert from "node:assert/strict";
import { validarDni, validarTelefono, validarCp, limpiarNumero, parseNumero, validarProspecto } from "../src/lib/validacion.js";
import { uuidV4 } from "../src/lib/ficha.js";

test("DNI: acepta válidos y rechaza letra incorrecta", () => {
  assert.equal(validarDni("12345678Z"), "");
  assert.equal(validarDni("X1234567L"), "");
  assert.match(validarDni("12345678A"), /letra/i);
  assert.match(validarDni("1234"), /no válido/i);
  assert.equal(validarDni(""), "", "vacío es válido: el campo es opcional");
});

test("Teléfono: 9 dígitos empezando por 6/7/8/9", () => {
  assert.equal(validarTelefono("612345678"), "");
  assert.equal(validarTelefono("+34 612 345 678"), "");
  assert.match(validarTelefono("12345678"), /no válido/i);
});

test("Código postal: 5 dígitos con provincia existente", () => {
  assert.equal(validarCp("46020"), "");
  assert.match(validarCp("4602"), /5 dígitos/);
  assert.match(validarCp("99000"), /inexistente/);
});

test("Números: los decimales sobreviven", () => {
  assert.equal(limpiarNumero("85,5"), "85,5");
  assert.equal(limpiarNumero("85.5"), "855", "el punto es separador de miles, no decimal");
  assert.equal(limpiarNumero("1a2b,3c4"), "12,34");
  assert.equal(limpiarNumero("1.234,56"), "1234,56", "el punto es separador de miles");
  assert.equal(limpiarNumero("85,5"), "85,5", "la coma es el decimal");
  assert.equal(limpiarNumero("250.000"), "250000");
  assert.equal(limpiarNumero("1.234.567"), "1234567");
  assert.equal(parseNumero("85,5"), 85.5);
  assert.equal(parseNumero("250.000"), 250000);
  assert.equal(parseNumero(""), null);
});

test("la referencia interna se normaliza al formato de la agencia", async () => {
  const { normalizarReferencia, validarReferencia } = await import("../src/lib/validacion.js");

  /* El agente puede escribirla de varias formas; siempre queda #00000. */
  assert.equal(normalizarReferencia("5618"), "#05618");
  assert.equal(normalizarReferencia("05618"), "#05618");
  assert.equal(normalizarReferencia("#5618"), "#05618");
  assert.equal(normalizarReferencia("#05618"), "#05618");
  assert.equal(normalizarReferencia(" 5618 "), "#05618");
  assert.equal(normalizarReferencia("1"), "#00001");
  assert.equal(normalizarReferencia("99999"), "#99999");
  assert.equal(normalizarReferencia(""), "", "vacía sigue vacía: el campo es opcional");

  assert.equal(validarReferencia("#05618"), "");
  assert.equal(validarReferencia("5618"), "");
  assert.equal(validarReferencia(""), "");
  assert.match(validarReferencia("REF-0001"), /#00000/, "el formato viejo ya no vale");
  assert.match(validarReferencia("123456"), /#00000/, "más de cinco dígitos no cabe");
  assert.match(validarReferencia("#abc"), /#00000/);

  /* Lo que no cuadra se deja intacto para que la validación pueda avisar,
     en vez de destrozarlo silenciosamente. */
  assert.equal(normalizarReferencia("REF-0001"), "REF-0001");
});

test("el prospecto solo acepta cifras", () => {
  /* Julia lo necesita como número: es el identificador de IA Gestión. El hueco
     del formulario pedía "Nombre del prospecto" y por eso llegó
     «Josefina Perez Lucena» en la captación #05613. */
  assert.equal(validarProspecto("4120"), "");
  assert.equal(validarProspecto("12345"), "");
  assert.equal(validarProspecto(""), "", "vacío no es un error: no es obligatorio");
  assert.match(validarProspecto("Josefina Perez Lucena"), /número/i);
  assert.match(validarProspecto("41 20"), /número/i, "ni con espacios");
  assert.match(validarProspecto("#4120"), /número/i, "esto es una referencia, no un prospecto");
});

test("el identificador de respaldo es un UUID que el servidor acepta", () => {
  /* El respaldo anterior devolvía "F1758…-a1b2c3", que no es un UUID: en un
     navegador sin crypto.randomUUID el servidor rechazaba TODAS las fichas,
     tanto del panel como del móvil, y nadie podía guardar nada. */
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const generados = new Set();
  for (let i = 0; i < 500; i++) {
    const id = uuidV4();
    assert.match(id, UUID_RE, `no es un UUID válido: ${id}`);
    assert.equal(id[14], "4", "debe declarar que es versión 4");
    assert.ok("89ab".includes(id[19].toLowerCase()), `variante incorrecta: ${id}`);
    generados.add(id);
  }
  assert.equal(generados.size, 500, "se han repetido identificadores");
});

test("el mismo validador del servidor lo da por bueno", async () => {
  /* Comprobado contra la función de verdad, no contra una copia de su regex. */
  const { fichaAFilaDeOficina } = await import("../api/_ficha.js");
  for (let i = 0; i < 50; i++) {
    assert.equal(fichaAFilaDeOficina({ id: uuidV4(), data: {} }).ok, true);
  }
  assert.equal(
    fichaAFilaDeOficina({ id: "F1758012345678-a1b2c3", data: {} }).ok,
    false,
    "el respaldo viejo tiene que seguir siendo inválido, para que se note si vuelve"
  );
});
